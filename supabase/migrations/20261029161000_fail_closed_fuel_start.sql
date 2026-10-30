-- Replace start/finish pair to enforce a verified private photo gate.
-- OilStation: station staff start and finish filling with price locked at start.
-- Trusted API must validate evidence upload, OCR and camera liveness; functions reject
-- plate mismatch and never release an active hold before settlement.
CREATE OR REPLACE FUNCTION public.start_reserved_fuel_session(
  p_actor_id uuid,p_coupon_id uuid,p_verified_plate text,p_plate_photo_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 c public.coupons%ROWTYPE;
 f public.station_fuel_products%ROWTYPE;
 v_account_id uuid;
 v_public numeric(12,4);
 v_net numeric(12,4);
 v_rule record;
 v_started timestamptz:=clock_timestamp();
 v_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO c FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 IF c.status<>'reserved' OR c.expires_at<=v_started THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_NOT_AVAILABLE';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
    AND ((m.scope_type='station' AND m.station_id=c.station_id AND
      (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
        OR m.extra_permissions->>'start_fueling'='true'))
     OR (m.scope_type='organization' AND m.organization_id=
      (SELECT s.organization_id FROM public.stations s WHERE s.id=c.station_id)
      AND m.role_code IN ('owner','organization_owner')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_plate_photo_path IS NULL OR char_length(p_plate_photo_path) NOT BETWEEN 8 AND 500 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_EVIDENCE_REQUIRED';
 END IF;
 IF c.plate_snapshot IS NOT NULL AND
  (p_verified_plate IS NULL OR
   regexp_replace(lower(p_verified_plate),'\s+','','g') <>
   regexp_replace(lower(c.plate_snapshot),'\s+','','g')) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_MISMATCH';
 END IF;
 -- Never trust the caller's typed plate/photo path as proof. A trusted OCR
 -- or supervisor review must attest the exact private Storage object.
 -- This gate deliberately denies fueling until that evidence workflow is live.
 IF NOT EXISTS (
  SELECT 1 FROM public.coupon_photo_checks pc
  JOIN storage.objects so
    ON so.bucket_id='oilstation-evidence' AND so.name=pc.photo_path
  WHERE pc.coupon_id=c.id AND pc.station_id=c.station_id
    AND pc.photo_path=p_plate_photo_path
    AND pc.decision IN ('verified_ocr','verified_supervisor')
    AND pc.checked_at IS NOT NULL
    AND (c.plate_snapshot IS NULL OR
       regexp_replace(lower(pc.observed_plate),'\s+','','g')=
       regexp_replace(lower(c.plate_snapshot),'\s+','','g'))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_VERIFICATION_REQUIRED';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.credit_reservations r
  WHERE r.coupon_id=c.id AND r.account_id=c.account_id
    AND r.status='held' AND r.amount_satang=c.max_amount_satang) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
 END IF;
 SELECT * INTO f FROM public.station_fuel_products
  WHERE id=c.station_fuel_id AND station_id=c.station_id AND enabled;
 IF NOT FOUND OR f.current_public_price IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRODUCT_NOT_AVAILABLE';
 END IF;
 SELECT x.price INTO v_public FROM (
  SELECT f.current_public_price AS price, '-infinity'::timestamptz AS effective_at
  UNION ALL SELECT v.public_price,v.effective_at FROM public.fuel_price_versions v
   WHERE v.station_fuel_id=f.id AND v.effective_at<=v_started
  UNION ALL SELECT sch.new_price,sch.effective_at FROM public.fuel_price_schedules sch
   WHERE sch.station_fuel_id=f.id AND sch.status IN ('pending','applied')
     AND sch.effective_at<=v_started
 ) x ORDER BY effective_at DESC LIMIT 1;
 v_net:=v_public;
 SELECT r.rule_type,r.value_per_liter INTO v_rule
   FROM public.corporate_price_rules r WHERE r.account_id=c.account_id
   AND r.station_fuel_id=f.id AND r.effective_from<=v_started
   AND (r.effective_to IS NULL OR r.effective_to>v_started)
 ORDER BY r.effective_from DESC,r.created_at DESC LIMIT 1;
 IF FOUND THEN
   IF v_rule.rule_type='fixed' THEN v_net:=v_rule.value_per_liter;
   ELSE v_net:=greatest(0::numeric,v_public-v_rule.value_per_liter); END IF;
 END IF;
 INSERT INTO public.fuel_sessions(id,coupon_id,station_id,station_fuel_id,
  operator_id,plate_verified_at,plate_verified_by,started_at,
  locked_public_price,locked_net_price)
 VALUES(v_id,c.id,c.station_id,f.id,p_actor_id,v_started,p_actor_id,v_started,
  v_public,v_net);
 INSERT INTO public.fuel_evidence(session_id,kind,storage_path)
  VALUES(v_id,'plate',p_plate_photo_path);
 UPDATE public.coupons SET status='fueling' WHERE id=c.id;
 RETURN jsonb_build_object('id',v_id,'coupon_id',c.id,'status','fueling',
  'started_at',v_started,'public_price',v_public,'corporate_price',v_net);
END
$fn$;

CREATE OR REPLACE FUNCTION public.finish_reserved_fuel_session(
 p_actor_id uuid,p_session_id uuid,p_liters numeric,p_pump_gross_satang bigint,
 p_pump_photo_path text,p_receipt_photo_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 s public.fuel_sessions%ROWTYPE;
 c public.coupons%ROWTYPE;
 a public.corporate_station_accounts%ROWTYPE;
 r public.credit_reservations%ROWTYPE;
 v_expected bigint;
 v_net bigint;
 v_prepaid_used bigint;
 v_debt bigint;
 v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO s FROM public.fuel_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 SELECT * INTO c FROM public.coupons WHERE id=s.coupon_id FOR UPDATE;
 -- Authorize BEFORE the completed-session replay branch. Replays must not
 -- expose financial amounts to an actor from another station.
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=s.station_id
  AND (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
    OR m.extra_permissions->>'finish_fueling'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF c.status='completed' AND s.status='completed' THEN
  RETURN jsonb_build_object('id',s.id,'status','completed','replayed',true,
    'net_amount_satang',s.net_amount_satang,'gross_amount_satang',s.pump_gross_satang);
 END IF;
 IF c.status<>'fueling' OR s.status<>'fueling' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SESSION_NOT_FUELING';
 END IF;
 -- Station privilege was already checked before the replay branch.
 IF p_liters IS NULL OR p_liters<=0 OR p_liters>9999999
  OR p_liters<>trunc(p_liters,3) OR p_pump_gross_satang IS NULL OR p_pump_gross_satang<0
  OR p_pump_photo_path IS NULL OR char_length(p_pump_photo_path) NOT BETWEEN 8 AND 500
  OR p_receipt_photo_path IS NULL OR char_length(p_receipt_photo_path) NOT BETWEEN 8 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 v_expected:=round(p_liters*s.locked_public_price*100)::bigint;
 IF abs(v_expected-p_pump_gross_satang)>100 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PUMP_AMOUNT_MISMATCH';
 END IF;
 v_net:=round(p_liters*s.locked_net_price*100)::bigint;
 IF v_net>c.max_amount_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_LIMIT_EXCEEDED';
 END IF;
 SELECT * INTO r FROM public.credit_reservations
  WHERE coupon_id=c.id AND status='held' FOR UPDATE;
 IF NOT FOUND OR r.amount_satang<>c.max_amount_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
 END IF;
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=c.account_id FOR UPDATE;
 IF a.reserved_satang<r.amount_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
 END IF;
 v_prepaid_used:=least(a.prepaid_balance_satang,v_net);
 v_debt:=v_net-v_prepaid_used;
 UPDATE public.corporate_station_accounts SET
  prepaid_balance_satang=prepaid_balance_satang-v_prepaid_used,
  debt_outstanding_satang=debt_outstanding_satang+v_debt,
  reserved_satang=reserved_satang-r.amount_satang WHERE id=a.id;
 UPDATE public.credit_reservations SET consumed_satang=v_net,
  released_satang=r.amount_satang-v_net,status='settled',closed_at=v_now WHERE id=r.id;
 UPDATE public.fuel_sessions SET status='completed',finished_at=v_now,
  liters=p_liters,pump_gross_satang=p_pump_gross_satang,net_amount_satang=v_net
 WHERE id=s.id;
 UPDATE public.coupons SET status='completed',completed_at=v_now WHERE id=c.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_prepaid_satang,
   delta_debt_satang,delta_reserved_satang,reference_type,reference_id)
 VALUES(a.id,'fuel_settlement',-v_prepaid_used,v_debt,-r.amount_satang,'fuel_session',s.id);
 IF v_debt>0 THEN
  INSERT INTO public.accounts_receivable(account_id,amount_satang,outstanding_satang,
   due_at,fuel_session_id)
  VALUES(a.id,v_debt,v_debt,v_now+(a.payment_terms_days::text||' days')::interval,s.id);
 END IF;
 INSERT INTO public.fuel_evidence(session_id,kind,storage_path)
 VALUES(s.id,'pump_display',p_pump_photo_path),(s.id,'receipt',p_receipt_photo_path);
 RETURN jsonb_build_object('id',s.id,'status','completed','replayed',false,
  'net_amount_satang',v_net,'gross_amount_satang',p_pump_gross_satang,
  'released_satang',r.amount_satang-v_net,'debt_created_satang',v_debt);
END
$fn$;

REVOKE ALL ON FUNCTION public.start_reserved_fuel_session(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_reserved_fuel_session(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text) TO service_role;
