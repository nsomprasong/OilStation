-- Atomic coupon replacement: revoke old QR and reserve the new amount in
-- one transaction, preserving the original shared link for drivers.
CREATE UNIQUE INDEX IF NOT EXISTS coupons_single_successor
  ON public.coupons(replaces_coupon_id) WHERE replaces_coupon_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.replace_reserved_coupon(
 p_actor_id uuid,p_old_coupon_id uuid,p_new_coupon_id uuid,
 p_new_account_id uuid,p_new_station_fuel_id uuid,p_new_amount_satang bigint,
 p_new_expires_at timestamptz,p_new_plate text,
 p_new_secret_hash text,p_new_qr_hash text,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 old_coupon public.coupons%ROWTYPE;
 old_account public.corporate_station_accounts%ROWTYPE;
 new_account public.corporate_station_accounts%ROWTYPE;
 old_hold public.credit_reservations%ROWTYPE;
 idempotent public.request_idempotency%ROWTYPE;
 new_coupon public.coupons%ROWTYPE;
 v_scope text;
 v_hash text;
 v_available numeric;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_actor_id IS NULL OR p_new_coupon_id IS NULL OR p_old_coupon_id IS NULL
  OR p_new_account_id IS NULL OR p_new_station_fuel_id IS NULL OR
  p_new_amount_satang IS NULL OR p_new_amount_satang<=0 OR
  p_new_expires_at IS NULL OR p_new_expires_at<=v_now OR
  p_new_secret_hash IS NULL OR p_new_secret_hash !~ '^[a-f0-9]{64}$' OR
  p_new_qr_hash IS NULL OR p_new_qr_hash !~ '^[a-f0-9]{64}$' OR
  p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT * INTO old_coupon FROM public.coupons WHERE id=p_old_coupon_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 -- Acquire wallet locks in deterministic account-ID order, preventing deadlocks
 -- for cross-station replacements and parallel issuance.
 PERFORM 1 FROM public.corporate_station_accounts
  WHERE id IN (old_coupon.account_id,p_new_account_id) ORDER BY id FOR UPDATE;
 SELECT * INTO old_account FROM public.corporate_station_accounts
   WHERE id=old_coupon.account_id;
 SELECT * INTO new_account FROM public.corporate_station_accounts
   WHERE id=p_new_account_id;
 IF new_account.id IS NULL OR new_account.company_id<>old_account.company_id THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='corporate_company' AND m.corporate_company_id=old_account.company_id
  AND (m.role_code IN ('corporate_admin','coupon_issuer','qr_issuer')
   OR m.extra_permissions->>'issue_coupon'='true')
  AND (m.role_code='corporate_admin' OR m.extra_permissions->>'cancel_coupon'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 v_scope:='coupon_replace:'||p_actor_id::text||':'||old_coupon.id::text;
 v_hash:=encode(extensions.digest(concat_ws('|',
  p_actor_id::text,p_old_coupon_id::text,p_new_account_id::text,p_new_station_fuel_id::text,
  p_new_amount_satang::text,p_new_expires_at::text,coalesce(btrim(p_new_plate),'')
 ),'sha256'),'hex');
 SELECT * INTO idempotent FROM public.request_idempotency
  WHERE scope_key=v_scope AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF idempotent.request_hash<>v_hash THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';
  END IF;
  SELECT * INTO new_coupon FROM public.coupons
   WHERE id=(idempotent.response_snapshot->>'id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
  RETURN jsonb_build_object('id',new_coupon.id,'status',new_coupon.status,
    'replayed',true,'old_coupon_id',old_coupon.id);
 END IF;
 IF old_coupon.status NOT IN ('reserved','verified') OR old_coupon.expires_at<=v_now THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_CANCELLABLE';
 END IF;
 SELECT * INTO old_hold FROM public.credit_reservations
  WHERE coupon_id=old_coupon.id AND status='held' FOR UPDATE;
 IF NOT FOUND OR old_hold.amount_satang<>old_coupon.max_amount_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.station_modules sm WHERE sm.station_id=new_account.station_id
   AND sm.module_code='qr_coupon' AND sm.status='enabled'
   AND (sm.valid_from IS NULL OR sm.valid_from<=v_now)
   AND (sm.valid_until IS NULL OR sm.valid_until>v_now)
 ) OR NOT EXISTS (
  SELECT 1 FROM public.station_fuel_products sf WHERE sf.id=p_new_station_fuel_id
   AND sf.station_id=new_account.station_id AND sf.enabled
   AND sf.current_public_price IS NOT NULL AND sf.current_public_price>0
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRODUCT_NOT_AVAILABLE'; END IF;
 -- Free only this coupon's unused reservation, then re-reserve for new station.
 UPDATE public.coupons SET status='cancelled',cancelled_at=v_now WHERE id=old_coupon.id;
 UPDATE public.coupon_versions SET revoked_at=v_now
  WHERE coupon_id=old_coupon.id AND revoked_at IS NULL;
 UPDATE public.credit_reservations SET status='released',
  released_satang=amount_satang,closed_at=v_now WHERE id=old_hold.id;
 UPDATE public.corporate_station_accounts
  SET reserved_satang=reserved_satang-old_hold.amount_satang WHERE id=old_account.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,reference_type,reference_id)
 VALUES(old_account.id,'coupon_replaced_release',-old_hold.amount_satang,
  'coupon',old_coupon.id);

 SELECT * INTO new_account FROM public.corporate_station_accounts
  WHERE id=p_new_account_id;
 v_available:=new_account.prepaid_balance_satang::numeric
    +new_account.credit_limit_satang::numeric
    -new_account.debt_outstanding_satang::numeric
    -new_account.reserved_satang::numeric;
 IF p_new_amount_satang::numeric>v_available THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INSUFFICIENT_FUNDS';
 END IF;
 INSERT INTO public.coupons(
  id,account_id,station_id,station_fuel_id,issued_by,plate_snapshot,
  max_amount_satang,secret_link_hash,status,expires_at,replaces_coupon_id)
 VALUES(p_new_coupon_id,new_account.id,new_account.station_id,p_new_station_fuel_id,
  p_actor_id,nullif(btrim(p_new_plate),''),p_new_amount_satang,p_new_secret_hash,
  'reserved',p_new_expires_at,old_coupon.id);
 INSERT INTO public.coupon_versions(coupon_id,version_number,qr_payload_hash)
 VALUES(p_new_coupon_id,1,p_new_qr_hash);
 INSERT INTO public.credit_reservations(coupon_id,account_id,amount_satang,status)
 VALUES(p_new_coupon_id,new_account.id,p_new_amount_satang,'held');
 UPDATE public.corporate_station_accounts
  SET reserved_satang=reserved_satang+p_new_amount_satang WHERE id=new_account.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,reference_type,reference_id)
 VALUES(new_account.id,'coupon_reserved',p_new_amount_satang,'coupon',p_new_coupon_id);
 INSERT INTO public.request_idempotency(
  scope_key,idempotency_key,request_hash,response_snapshot,expires_at)
 VALUES(v_scope,p_idempotency_key,v_hash,jsonb_build_object('id',p_new_coupon_id),
  greatest(v_now+interval '30 days',p_new_expires_at));
 RETURN jsonb_build_object('id',p_new_coupon_id,'old_coupon_id',old_coupon.id,
  'status','reserved','replayed',false,'available_satang',
  (v_available-p_new_amount_satang)::text);
END
$fn$;
REVOKE ALL ON FUNCTION public.replace_reserved_coupon(
 uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_reserved_coupon(
 uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,text,text,text,text)
 TO service_role;
