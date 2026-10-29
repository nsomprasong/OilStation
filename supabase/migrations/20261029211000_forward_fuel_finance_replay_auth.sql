-- Forward-only production correction: 20261029161000 was already applied
-- under an earlier migration version. Editing that historical SQL in Git
-- cannot change the existing function in the Supabase database.
-- Retain all prior finance math but authenticate the operator BEFORE
-- returning completed-session details, including idempotent replays.
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

-- Preserve the end-to-end evidence gate from 20261029208000. Replacing an
-- already-installed function must never restore raw service-role access.
REVOKE ALL ON FUNCTION public.finish_reserved_fuel_session(
 uuid,uuid,numeric,bigint,text,text) FROM PUBLIC,anon,authenticated,service_role;
