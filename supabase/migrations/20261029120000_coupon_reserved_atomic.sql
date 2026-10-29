-- OilStation coupon issuance: service_role-only PostgreSQL transaction.
-- Requires existing tables from rebuild_oilstation_saas_schema_20261029.
-- Do not grant this RPC to anon or authenticated.
CREATE OR REPLACE FUNCTION public.issue_reserved_coupon(
  p_coupon_id uuid,
  p_actor_id uuid,
  p_account_id uuid,
  p_station_fuel_id uuid,
  p_amount_satang bigint,
  p_expires_at timestamptz,
  p_plate text,
  p_secret_hash text,
  p_qr_hash text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_account public.corporate_station_accounts%ROWTYPE;
  v_available numeric;
  v_request_hash text;
  v_scope text;
  v_old public.request_idempotency%ROWTYPE;
  v_old_coupon public.coupons%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
BEGIN
  IF p_coupon_id IS NULL OR p_actor_id IS NULL OR p_account_id IS NULL OR p_station_fuel_id IS NULL
    OR p_amount_satang IS NULL OR p_amount_satang <= 0
    OR p_secret_hash !~ '^[a-f0-9]{64}$'
    OR p_qr_hash !~ '^[a-f0-9]{64}$'
    OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_REQUEST';
  END IF;
  -- Row lock serializes all parallel issuance attempts on the same corporate-station wallet.
  SELECT * INTO v_account FROM public.corporate_station_accounts WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ACCOUNT_NOT_FOUND';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
      AND m.corporate_company_id=v_account.company_id
      AND (m.role_code IN ('corporate_admin','coupon_issuer','qr_issuer')
         OR m.extra_permissions->>'issue_coupon'='true')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FORBIDDEN';
  END IF;
  v_scope := 'coupon_issue:' || p_actor_id::text || ':' || p_account_id::text;
  v_request_hash := encode(extensions.digest(
    concat_ws('|',p_actor_id::text,p_account_id::text,p_station_fuel_id::text,
       p_amount_satang::text,p_expires_at::text,coalesce(btrim(p_plate),''))
    ,'sha256'),'hex');
  SELECT * INTO v_old FROM public.request_idempotency
  WHERE scope_key=v_scope AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_old.request_hash <> v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='IDEMPOTENCY_CONFLICT';
    END IF;
    SELECT * INTO v_old_coupon FROM public.coupons
    WHERE id=(v_old.response_snapshot->>'id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_REQUEST';
    END IF;
    RETURN jsonb_build_object('id',v_old_coupon.id,'status',v_old_coupon.status,
      'replayed',true,'expires_at',v_old_coupon.expires_at,
      'available_satang',(v_account.prepaid_balance_satang::numeric
      + v_account.credit_limit_satang::numeric
      - v_account.debt_outstanding_satang::numeric
      - v_account.reserved_satang::numeric)::text);
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= v_now THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INVALID_REQUEST';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.station_modules sm
    WHERE sm.station_id=v_account.station_id AND sm.module_code='qr_coupon'
      AND sm.status='enabled'
      AND (sm.valid_from IS NULL OR sm.valid_from <= v_now)
      AND (sm.valid_until IS NULL OR sm.valid_until > v_now)
  ) OR NOT EXISTS (
    SELECT 1 FROM public.station_fuel_products sf
    WHERE sf.id=p_station_fuel_id AND sf.station_id=v_account.station_id
      AND sf.enabled AND sf.current_public_price > 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='PRODUCT_NOT_AVAILABLE';
  END IF;
  v_available := v_account.prepaid_balance_satang::numeric
    + v_account.credit_limit_satang::numeric
    - v_account.debt_outstanding_satang::numeric
    - v_account.reserved_satang::numeric;
  IF p_amount_satang::numeric > v_available THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='INSUFFICIENT_FUNDS';
  END IF;
  INSERT INTO public.coupons(
    id,account_id,station_id,station_fuel_id,issued_by,plate_snapshot,max_amount_satang,
    secret_link_hash,status,expires_at)
  VALUES (p_coupon_id,p_account_id,v_account.station_id,p_station_fuel_id,p_actor_id,
    nullif(btrim(p_plate),''),p_amount_satang,p_secret_hash,'reserved',p_expires_at);
  INSERT INTO public.coupon_versions(coupon_id,version_number,qr_payload_hash)
  VALUES (p_coupon_id,1,p_qr_hash);
  INSERT INTO public.credit_reservations(coupon_id,account_id,amount_satang,status)
  VALUES (p_coupon_id,p_account_id,p_amount_satang,'held');
  UPDATE public.corporate_station_accounts
    SET reserved_satang=reserved_satang+p_amount_satang
    WHERE id=p_account_id;
  INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,reference_type,reference_id)
  VALUES (p_account_id,'coupon_reserved',p_amount_satang,'coupon',p_coupon_id);
  v_available := v_available-p_amount_satang;
  v_result := jsonb_build_object('id',p_coupon_id,'status','reserved',
     'replayed',false,'expires_at',p_expires_at,'available_satang',v_available::text);
  INSERT INTO public.request_idempotency(scope_key,idempotency_key,request_hash,response_snapshot,expires_at)
  VALUES(v_scope,p_idempotency_key,v_request_hash,jsonb_build_object('id',p_coupon_id),
    greatest(p_expires_at, v_now+interval '30 days'));
  RETURN v_result;
END
$fn$;
REVOKE ALL ON FUNCTION public.issue_reserved_coupon(uuid,uuid,uuid,uuid,bigint,timestamptz,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_reserved_coupon(uuid,uuid,uuid,uuid,bigint,timestamptz,text,text,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_reserved_coupon(
  p_actor_id uuid,p_coupon_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_res public.credit_reservations%ROWTYPE;
  v_company uuid;
BEGIN
  SELECT * INTO v_coupon FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
  END IF;
  SELECT company_id INTO v_company FROM public.corporate_station_accounts
    WHERE id=v_coupon.account_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
      AND m.corporate_company_id=v_company
      AND (m.role_code='corporate_admin' OR m.extra_permissions->>'cancel_coupon'='true')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
  END IF;
  IF v_coupon.status IN ('cancelled','expired') THEN
    RETURN jsonb_build_object('id',p_coupon_id,'status',v_coupon.status,'released',false);
  END IF;
  IF v_coupon.status NOT IN ('reserved','verified') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_CANCELLABLE';
  END IF;
  SELECT * INTO v_res FROM public.credit_reservations
    WHERE coupon_id=p_coupon_id FOR UPDATE;
  IF NOT FOUND OR v_res.status<>'held' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
  END IF;
  UPDATE public.coupons SET status='cancelled',cancelled_at=clock_timestamp()
    WHERE id=p_coupon_id;
  UPDATE public.coupon_versions SET revoked_at=clock_timestamp()
    WHERE coupon_id=p_coupon_id AND revoked_at IS NULL;
  UPDATE public.credit_reservations SET released_satang=amount_satang,
     status='released',closed_at=clock_timestamp() WHERE id=v_res.id;
  UPDATE public.corporate_station_accounts
    SET reserved_satang=reserved_satang-v_res.amount_satang
    WHERE id=v_coupon.account_id;
  INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,reference_type,reference_id)
  VALUES(v_coupon.account_id,'coupon_cancel_release',-v_res.amount_satang,'coupon',p_coupon_id);
  RETURN jsonb_build_object('id',p_coupon_id,'status','cancelled','released',true);
END
$fn$;
REVOKE ALL ON FUNCTION public.cancel_reserved_coupon(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reserved_coupon(uuid,uuid) TO service_role;
