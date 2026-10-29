-- Read-only deployed routine definitions (public namespace) from 2026-10-29.
-- Metadata and function source ONLY: no customers, tokens, or SQL row data.
-- A disposable historical function snapshot, not a migration or live backup.
-- Function privileges are reconstructed from observed anon/authenticated/service_role EXECUTE access.

CREATE OR REPLACE FUNCTION public.accept_member_invitation(p_actor_id uuid, p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_auth_email text;
  v_confirmed_at timestamptz;
  v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_INVITATION';
  END IF;
  SELECT u.email,u.email_confirmed_at INTO v_auth_email,v_confirmed_at
    FROM auth.users u WHERE u.id=p_actor_id;
  IF v_auth_email IS NULL OR v_confirmed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
  END IF;
  SELECT * INTO v_inv FROM public.invitations
    WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL
    OR v_inv.expires_at<=v_now THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITE_INVALID_OR_EXPIRED';
  END IF;
  IF lower(btrim(v_auth_email))<>lower(btrim(v_inv.email)) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITED_EMAIL_MISMATCH';
  END IF;
  IF NOT (
   (v_inv.scope_type='platform' AND v_inv.organization_id IS NULL
      AND v_inv.station_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='organization' AND v_inv.organization_id IS NOT NULL
      AND v_inv.station_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='station' AND v_inv.station_id IS NOT NULL
      AND v_inv.organization_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='corporate_company' AND v_inv.corporate_company_id IS NOT NULL
      AND v_inv.station_id IS NULL AND v_inv.organization_id IS NULL)
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_INVITATION'; END IF;
  INSERT INTO public.app_users(id,email) VALUES(p_actor_id,v_auth_email)
   ON CONFLICT (id) DO UPDATE SET email=excluded.email;
  INSERT INTO public.memberships(user_id,role_code,scope_type,
    organization_id,station_id,corporate_company_id,extra_permissions)
  VALUES(p_actor_id,v_inv.role_code,v_inv.scope_type,v_inv.organization_id,
    v_inv.station_id,v_inv.corporate_company_id,v_inv.permissions)
  ON CONFLICT DO NOTHING;
  UPDATE public.invitations SET accepted_at=v_now WHERE id=v_inv.id;
  INSERT INTO public.audit_events(actor_id,station_id,organization_id,entity_type,
    entity_id,action,after_state)
  VALUES(p_actor_id,v_inv.station_id,v_inv.organization_id,'invitation',
    v_inv.id::text,'accepted',jsonb_build_object('scope_type',v_inv.scope_type,
      'role_code',v_inv.role_code));
  RETURN jsonb_build_object('accepted',true,'scope_type',v_inv.scope_type,
    'role_code',v_inv.role_code);
END
$function$
;
REVOKE ALL ON FUNCTION accept_member_invitation(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION accept_member_invitation(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_corporate_station_link(p_actor_id uuid, p_request_id uuid, p_approved boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_request public.corporate_station_link_requests%ROWTYPE; v_account uuid;
BEGIN
 SELECT * INTO v_request FROM public.corporate_station_link_requests
 WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='corporate_company' AND m.corporate_company_id=v_request.company_id
  AND m.role_code='corporate_admin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF v_request.status<>'pending' THEN
  RETURN jsonb_build_object('status',v_request.status,'replayed',true);
 END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_approved THEN
  INSERT INTO public.corporate_station_accounts(station_id,company_id)
  VALUES(v_request.station_id,v_request.company_id)
  ON CONFLICT(station_id,company_id) DO UPDATE SET station_id=excluded.station_id
  RETURNING id INTO v_account;
 END IF;
 UPDATE public.corporate_station_link_requests SET
  status=case when p_approved then 'approved' else 'rejected' end,
  reviewed_by=p_actor_id,reviewed_at=clock_timestamp()
 WHERE id=p_request_id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,v_request.station_id,'corporate_station_link',p_request_id::text,
  case when p_approved then 'approved' else 'rejected' end);
 RETURN jsonb_build_object('status',case when p_approved then 'approved' else 'rejected' end,
  'accountId',v_account,'replayed',false);
END $function$
;
REVOKE ALL ON FUNCTION approve_corporate_station_link(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION approve_corporate_station_link(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_corporate_topup_upload(p_actor_id uuid, p_account_id uuid, p_station_bank_id uuid, p_amount_satang bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.corporate_station_accounts%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(
  SELECT 1 FROM public.station_bank_accounts b WHERE b.id=p_station_bank_id
   AND b.station_id=v.station_id AND b.active
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BANK_ACCOUNT'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company'
   AND m.corporate_company_id=v.company_id
   AND (m.role_code IN ('corporate_admin','accountant','finance_manager')
     OR m.extra_permissions->>'request_topup'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_amount_satang IS NULL OR p_amount_satang<100
  OR p_amount_satang>100000000000 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 RETURN jsonb_build_object('allowed',true,'accountId',p_account_id,
   'stationId',v.station_id);
END $function$
;
REVOKE ALL ON FUNCTION authorize_corporate_topup_upload(uuid,uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION authorize_corporate_topup_upload(uuid,uuid,uuid,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_station_plate_upload(p_actor_id uuid, p_station_id uuid, p_coupon_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.coupons%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.coupons WHERE id=p_coupon_id;
 IF NOT FOUND OR c.station_id<>p_station_id
  OR c.status NOT IN ('reserved','verified')
  OR c.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_NOT_AVAILABLE';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND
   ((m.scope_type='station' AND m.station_id=p_station_id
     AND (m.role_code IN ('station_owner','owner','manager','attendant','pump_staff')
       OR m.extra_permissions->>'start_fueling'='true'))
    OR (m.scope_type='organization' AND m.organization_id=
      (SELECT organization_id FROM public.stations WHERE id=p_station_id)
      AND m.role_code IN ('organization_owner','owner')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN jsonb_build_object('authorized',true,'stationId',p_station_id,'couponId',p_coupon_id);
END $function$
;
REVOKE ALL ON FUNCTION authorize_station_plate_upload(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION authorize_station_plate_upload(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_station_topup_slip(p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.topup_requests%ROWTYPE; v_station uuid;
BEGIN
 SELECT * INTO t FROM public.topup_requests WHERE id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 SELECT station_id INTO v_station FROM public.corporate_station_accounts
 WHERE id=t.account_id;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='station' AND m.station_id=v_station
   AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
     OR m.extra_permissions->>'approve_topup'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF t.slip_storage_path IS NULL OR NOT EXISTS(
   SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-slips'
    AND o.name=t.slip_storage_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE'; END IF;
 RETURN jsonb_build_object('path',t.slip_storage_path);
END $function$
;
REVOKE ALL ON FUNCTION authorize_station_topup_slip(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION authorize_station_topup_slip(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_first_platform_admin(p_actor_id uuid, p_expected_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 auth_email text;
 auth_confirmed timestamptz;
BEGIN
 IF p_actor_id IS NULL OR nullif(btrim(p_expected_email),'') IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BOOTSTRAP_FORBIDDEN';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'oilstation:first_platform_admin',0));
 IF EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.scope_type='platform' AND m.role_code='platform_superadmin' AND m.active) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_BOOTSTRAPPED';
 END IF;
 SELECT u.email,u.email_confirmed_at INTO auth_email,auth_confirmed
 FROM auth.users u WHERE u.id=p_actor_id;
 IF auth_email IS NULL OR auth_confirmed IS NULL
   OR lower(btrim(auth_email))<>lower(btrim(p_expected_email)) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BOOTSTRAP_FORBIDDEN';
 END IF;
 INSERT INTO public.app_users(id,email,status) VALUES(p_actor_id,auth_email,'active')
 ON CONFLICT(id) DO UPDATE SET email=excluded.email;
 INSERT INTO public.memberships(user_id,role_code,scope_type,active)
 VALUES(p_actor_id,'platform_superadmin','platform',true)
 ON CONFLICT DO NOTHING;
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'platform',p_actor_id::text,'first_admin_bootstrapped',
  jsonb_build_object('role_code','platform_superadmin'));
 RETURN jsonb_build_object('success',true,'role','platform_superadmin');
END
$function$
;
REVOKE ALL ON FUNCTION bootstrap_first_platform_admin(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION bootstrap_first_platform_admin(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_reserved_coupon(p_actor_id uuid, p_coupon_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
REVOKE ALL ON FUNCTION cancel_reserved_coupon(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION cancel_reserved_coupon(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.configure_station_fuel(p_actor_id uuid, p_station_id uuid, p_station_fuel_id uuid, p_enabled boolean, p_public_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 f public.station_fuel_products%ROWTYPE;
 price_changed boolean;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND (
    (m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id AND
      (m.role_code IN ('station_owner','owner','manager')
       OR m.extra_permissions->>'manage_fuel_prices'='true'))
    OR (m.scope_type='organization' AND m.organization_id=
     (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
     AND m.role_code IN ('organization_owner','owner'))
  )
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 SELECT * INTO f FROM public.station_fuel_products
 WHERE id=p_station_fuel_id AND station_id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 IF p_enabled IS NULL OR p_public_price IS NULL OR
  p_public_price<=0 OR p_public_price>99999999 OR
  p_public_price<>trunc(p_public_price,4) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 price_changed:=f.current_public_price IS DISTINCT FROM p_public_price;
 UPDATE public.station_fuel_products
 SET current_public_price=p_public_price,enabled=p_enabled
 WHERE id=f.id;
 IF price_changed THEN
  INSERT INTO public.fuel_price_versions(station_fuel_id,public_price,effective_at,created_by)
  VALUES(f.id,p_public_price,v_now,p_actor_id);
 END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,before_state,after_state)
 VALUES(p_actor_id,p_station_id,'station_fuel',f.id::text,'fuel_pricing_updated',
 jsonb_build_object('enabled',f.enabled,'price',f.current_public_price),
 jsonb_build_object('enabled',p_enabled,'price',p_public_price));
 RETURN jsonb_build_object('id',f.id,'enabled',p_enabled,
  'publicPrice',p_public_price::text,'priceChanged',price_changed);
END $function$
;
REVOKE ALL ON FUNCTION configure_station_fuel(uuid,uuid,uuid,boolean,numeric) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION configure_station_fuel(uuid,uuid,uuid,boolean,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.corporate_account_fuel_offers(p_actor_id uuid, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 a public.corporate_station_accounts%ROWTYPE;
 result jsonb;
 v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company' AND m.corporate_company_id=a.company_id
   AND (m.role_code IN ('corporate_admin','coupon_issuer','qr_issuer')
    OR m.extra_permissions->>'issue_coupon'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id', f.id,'stationId',f.station_id,
   'name',coalesce(f.name_override,f.custom_name,p.name_th),
   'publicPrice',round(pub.public_price,2)::text,
   'corporatePrice',round(case
      when cr.rule_type='fixed' then cr.value_per_liter
      when cr.rule_type='discount' then greatest(0::numeric,pub.public_price-cr.value_per_liter)
      else pub.public_price end,2)::text
  ) ORDER BY coalesce(f.name_override,f.custom_name,p.name_th)),'[]'::jsonb)
 INTO result
 FROM public.station_fuel_products f
 LEFT JOIN public.brand_fuel_products p ON p.id=f.brand_product_id
 JOIN LATERAL (
  SELECT x.price AS public_price FROM (
   SELECT f.current_public_price AS price,'-infinity'::timestamptz AS effective_at
   UNION ALL SELECT ver.public_price,ver.effective_at
    FROM public.fuel_price_versions ver
    WHERE ver.station_fuel_id=f.id AND ver.effective_at<=v_now
   UNION ALL SELECT sch.new_price,sch.effective_at
    FROM public.fuel_price_schedules sch
    WHERE sch.station_fuel_id=f.id AND sch.status IN ('pending','applied')
     AND sch.effective_at<=v_now
  ) x ORDER BY x.effective_at DESC LIMIT 1
 ) pub ON true
 LEFT JOIN LATERAL (
  SELECT r.rule_type,r.value_per_liter FROM public.corporate_price_rules r
  WHERE r.account_id=a.id AND r.station_fuel_id=f.id
    AND r.effective_from<=v_now AND (r.effective_to IS NULL OR r.effective_to>v_now)
  ORDER BY r.effective_from DESC,r.created_at DESC LIMIT 1
 ) cr ON true
 WHERE f.station_id=a.station_id AND f.enabled
  AND EXISTS (SELECT 1 FROM public.station_modules sm
    WHERE sm.station_id=a.station_id AND sm.module_code='qr_coupon'
      AND sm.status='enabled'
      AND (sm.valid_from IS NULL OR sm.valid_from<=v_now)
      AND (sm.valid_until IS NULL OR sm.valid_until>v_now));
 RETURN result;
END
$function$
;
REVOKE ALL ON FUNCTION corporate_account_fuel_offers(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION corporate_account_fuel_offers(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.corporate_account_summaries(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 result jsonb;
BEGIN
 IF p_actor_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id', a.id,
   'stationId', a.station_id,
   'stationName', s.name,
   'companyId', a.company_id,
   'companyName', c.name,
   'availableSatang', greatest(0::numeric,
     a.prepaid_balance_satang::numeric+a.credit_limit_satang::numeric
       -a.debt_outstanding_satang::numeric-a.reserved_satang::numeric)::text,
   'prepaidSatang', a.prepaid_balance_satang::text,
   'creditLimitSatang', a.credit_limit_satang::text,
   'debtSatang', a.debt_outstanding_satang::text,
   'reservedSatang', a.reserved_satang::text,
   'couponModuleEnabled', coalesce(sm.status='enabled',false)
  ) ORDER BY s.name),'[]'::jsonb)
 INTO result FROM public.corporate_station_accounts a
 JOIN public.stations s ON s.id=a.station_id AND s.status='active'
 JOIN public.corporate_companies c ON c.id=a.company_id AND c.status='active'
 LEFT JOIN public.station_modules sm ON sm.station_id=s.id AND sm.module_code='qr_coupon'
 WHERE EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company' AND m.corporate_company_id=a.company_id
   AND (m.role_code IN ('corporate_admin','coupon_issuer','qr_issuer',
                        'accountant','finance_manager')
        OR m.extra_permissions->>'view_balance'='true')
 );
 RETURN result;
END
$function$
;
REVOKE ALL ON FUNCTION corporate_account_summaries(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION corporate_account_summaries(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.corporate_topup_bank_options(p_actor_id uuid, p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_station uuid; v_company uuid; result jsonb;
BEGIN
  SELECT a.station_id,a.company_id INTO v_station,v_company
  FROM public.corporate_station_accounts a WHERE a.id=p_account_id;
  IF v_station IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
      AND m.corporate_company_id=v_company
      AND (m.role_code IN ('corporate_admin','accountant','finance_manager')
       OR m.extra_permissions->>'request_topup'='true')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'bankCode',b.bank_code,'accountName',b.account_name,
    'accountNumberMasked',coalesce(b.account_number_masked,''),
    'isPrimary',b.is_primary
  ) ORDER BY b.is_primary DESC,b.created_at ASC),'[]'::jsonb) INTO result
  FROM public.station_bank_accounts b
  WHERE b.station_id=v_station AND b.active;
  RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION corporate_topup_bank_options(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION corporate_topup_bank_options(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_scoped_invitation(p_actor_id uuid, p_email text, p_role_code text, p_scope_type text, p_organization_id uuid, p_station_id uuid, p_company_id uuid, p_token_hash text, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_now timestamptz:=clock_timestamp();
 v_platform_admin boolean;
 v_allowed boolean:=false;
 v_inv_id uuid:=gen_random_uuid();
BEGIN
 IF p_actor_id IS NULL OR p_email IS NULL OR
  p_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  OR length(p_email)>320
  OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
  OR p_expires_at IS NULL OR p_expires_at<=v_now
  OR p_expires_at>v_now+interval '30 days' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.scope_type='platform' AND m.role_code='platform_superadmin'
   AND m.active) INTO v_platform_admin;

 IF p_scope_type='station' THEN
  IF p_station_id IS NULL OR p_organization_id IS NOT NULL OR p_company_id IS NOT NULL
    OR p_role_code NOT IN ('station_owner','manager','cashier','pump_staff','attendant') OR
    NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=p_station_id
    AND (m.role_code IN ('station_owner','owner')
      OR (m.role_code='manager' AND m.extra_permissions->>'invite_staff'='true'))
  ) OR EXISTS(
    SELECT 1 FROM public.memberships m JOIN public.stations s
    ON s.id=p_station_id WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=s.organization_id
    AND m.role_code IN ('organization_owner','owner')
  );
  IF p_role_code='station_owner' AND NOT v_platform_admin THEN
    v_allowed:=EXISTS(
      SELECT 1 FROM public.memberships m
      JOIN public.stations s ON s.organization_id=m.organization_id
      WHERE s.id=p_station_id AND m.user_id=p_actor_id AND m.active
      AND m.scope_type='organization' AND m.role_code IN ('organization_owner','owner')
    );
  END IF;
 ELSIF p_scope_type='corporate_company' THEN
  IF p_company_id IS NULL OR p_station_id IS NOT NULL OR p_organization_id IS NOT NULL
  OR p_role_code NOT IN ('corporate_admin','coupon_issuer','accountant','finance_manager','driver')
  OR NOT EXISTS(SELECT 1 FROM public.corporate_companies c WHERE c.id=p_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='corporate_company' AND m.corporate_company_id=p_company_id
    AND (m.role_code='corporate_admin'
      OR m.extra_permissions->>'invite_company_staff'='true')
  );
 ELSIF p_scope_type='organization' THEN
  IF p_organization_id IS NULL OR p_station_id IS NOT NULL OR p_company_id IS NOT NULL
    OR p_role_code NOT IN ('organization_owner','organization_manager')
    OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=p_organization_id
    AND m.role_code='organization_owner'
  );
  IF p_role_code='organization_owner' AND NOT v_platform_admin THEN
    v_allowed:=false;
  END IF;
 ELSIF p_scope_type='platform' THEN
  IF p_role_code NOT IN ('platform_sales','platform_support')
    OR p_company_id IS NOT NULL OR p_station_id IS NOT NULL
    OR p_organization_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin;
 ELSE
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF NOT v_allowed THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;

 INSERT INTO public.invitations(id,email,token_hash,role_code,scope_type,
    organization_id,station_id,corporate_company_id,invited_by,expires_at)
 VALUES(v_inv_id,lower(btrim(p_email)),p_token_hash,p_role_code,p_scope_type,
    p_organization_id,p_station_id,p_company_id,p_actor_id,p_expires_at);
 INSERT INTO public.audit_events(actor_id,station_id,organization_id,entity_type,
   entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,p_organization_id,'invitation',v_inv_id::text,
  'invite_created',jsonb_build_object('scope_type',p_scope_type,
    'role_code',p_role_code));
 RETURN jsonb_build_object('id',v_inv_id,'email',lower(btrim(p_email)),
   'role',p_role_code,'scopeType',p_scope_type,'expiresAt',p_expires_at);
END $function$
;
REVOKE ALL ON FUNCTION create_scoped_invitation(uuid,text,text,text,uuid,uuid,uuid,text,timestamp with time zone) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION create_scoped_invitation(uuid,text,text,text,uuid,uuid,uuid,text,timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_reserved_coupons(p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_coupon public.coupons%ROWTYPE;
 v_hold public.credit_reservations%ROWTYPE;
 v_count integer:=0;
 v_total bigint:=0;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 FOR v_coupon IN
  SELECT * FROM public.coupons
  WHERE status IN ('reserved','verified') AND expires_at<=v_now
  ORDER BY expires_at,id
  LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  SELECT * INTO v_hold FROM public.credit_reservations
  WHERE coupon_id=v_coupon.id FOR UPDATE;
  IF NOT FOUND OR v_hold.status<>'held'
   OR v_hold.amount_satang<>v_coupon.max_amount_satang THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
  END IF;
  UPDATE public.corporate_station_accounts
   SET reserved_satang=reserved_satang-v_hold.amount_satang
   WHERE id=v_coupon.account_id AND reserved_satang>=v_hold.amount_satang;
  IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
  END IF;
  UPDATE public.credit_reservations
   SET released_satang=amount_satang,status='released',closed_at=v_now
   WHERE id=v_hold.id;
  UPDATE public.coupons SET status='expired' WHERE id=v_coupon.id;
  UPDATE public.coupon_versions SET revoked_at=v_now
   WHERE coupon_id=v_coupon.id AND revoked_at IS NULL;
  INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,
   reference_type,reference_id)
  VALUES(v_coupon.account_id,'coupon_expired_release',-v_hold.amount_satang,
   'coupon',v_coupon.id);
  v_count:=v_count+1;
  v_total:=v_total+v_hold.amount_satang;
 END LOOP;
 RETURN jsonb_build_object('expired',v_count,'releasedSatang',v_total::text);
END $function$
;
REVOKE ALL ON FUNCTION expire_reserved_coupons(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION expire_reserved_coupons(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_reserved_fuel_session(p_actor_id uuid, p_session_id uuid, p_liters numeric, p_pump_gross_satang bigint, p_pump_photo_path text, p_receipt_photo_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF c.status='completed' AND s.status='completed' THEN
  RETURN jsonb_build_object('id',s.id,'status','completed','replayed',true,
    'net_amount_satang',s.net_amount_satang,'gross_amount_satang',s.pump_gross_satang);
 END IF;
 IF c.status<>'fueling' OR s.status<>'fueling' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SESSION_NOT_FUELING';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=s.station_id
  AND (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
   OR m.extra_permissions->>'finish_fueling'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
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
$function$
;
REVOKE ALL ON FUNCTION finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_add_employee(p_actor_id uuid, p_station_id uuid, p_employee_code text, p_name text, p_wage_type text, p_wage_satang bigint, p_payroll_frequency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.module_code='hr_payroll'
    AND sm.status='enabled') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
  OR (m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
  OR (m.scope_type='organization' AND m.organization_id=
   (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
   AND m.role_code IN ('organization_owner','owner'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_employee_code IS NULL OR length(btrim(p_employee_code)) NOT BETWEEN 1 AND 40
  OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 200
  OR p_wage_type NOT IN ('monthly','daily','hourly')
  OR p_wage_satang IS NULL OR p_wage_satang<0
  OR p_payroll_frequency NOT IN ('weekly','semi_monthly','monthly') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.employees(id,station_id,employee_code,display_name,
  employment_status,wage_type,wage_satang,payroll_frequency)
 VALUES(v_id,p_station_id,btrim(p_employee_code),btrim(p_name),'active',
  p_wage_type,p_wage_satang,p_payroll_frequency);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,p_station_id,'employee',v_id::text,'employee_created');
 RETURN jsonb_build_object('id',v_id,'name',btrim(p_name),'stationId',p_station_id);
END $function$
;
REVOKE ALL ON FUNCTION hr_add_employee(uuid,uuid,text,text,text,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_add_employee(uuid,uuid,text,text,text,bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_approve_overtime(p_actor_id uuid, p_request_id uuid, p_approved_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 r public.overtime_requests%ROWTYPE;
 e public.employees%ROWTYPE;
 v_status text;
BEGIN
 SELECT * INTO r FROM public.overtime_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO e FROM public.employees WHERE id=r.employee_id;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND (
    (m.scope_type='station' AND m.station_id=e.station_id
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='platform' AND m.role_code='platform_superadmin')
   )
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_actor_id=e.user_id THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';
 END IF;
 IF r.status<>'pending' THEN
  RETURN jsonb_build_object('requestId',r.id,'status',r.status,'replayed',true);
 END IF;
 IF p_approved_minutes IS NULL OR p_approved_minutes<0
   OR p_approved_minutes>r.requested_minutes THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 v_status:=case when p_approved_minutes=0 then 'rejected'
    when p_approved_minutes=r.requested_minutes then 'approved' else 'partial' end;
 UPDATE public.overtime_requests SET approved_minutes=p_approved_minutes,
   status=v_status,approved_by=p_actor_id,approved_at=clock_timestamp()
 WHERE id=r.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,
  after_state) VALUES(p_actor_id,e.station_id,'overtime_request',r.id::text,'overtime_reviewed',
  jsonb_build_object('approved_minutes',p_approved_minutes,'status',v_status));
 RETURN jsonb_build_object('requestId',r.id,'status',v_status,
   'approvedMinutes',p_approved_minutes,'replayed',false);
END $function$
;
REVOKE ALL ON FUNCTION hr_approve_overtime(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_approve_overtime(uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_assign_shift(p_actor_id uuid, p_employee_id uuid, p_template_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_station uuid;v_template_station uuid;v_id uuid:=gen_random_uuid();
BEGIN
 SELECT station_id INTO v_station FROM public.employees
  WHERE id=p_employee_id AND employment_status='active';
 SELECT station_id INTO v_template_station FROM public.shift_templates
  WHERE id=p_template_id AND active;
 IF v_station IS NULL OR v_template_station IS NULL
    OR v_station<>v_template_station OR p_date IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='station' AND m.station_id=v_station
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_date<current_date-30 OR p_date>current_date+365 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT_DATE';END IF;
 INSERT INTO public.shift_assignments(id,employee_id,shift_template_id,shift_date,status)
 VALUES(v_id,p_employee_id,p_template_id,p_date,'scheduled')
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN
   SELECT id INTO v_id FROM public.shift_assignments
   WHERE employee_id=p_employee_id AND shift_template_id=p_template_id
     AND shift_date=p_date AND status<>'cancelled' LIMIT 1;
 END IF;
 RETURN jsonb_build_object('id',v_id,'employeeId',p_employee_id,
   'shiftDate',p_date,'templateId',p_template_id);
END $function$
;
REVOKE ALL ON FUNCTION hr_assign_shift(uuid,uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_assign_shift(uuid,uuid,uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_pending_overtime(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND (
    (m.scope_type='station' AND m.station_id=p_station_id
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='platform' AND m.role_code='platform_superadmin')
  )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'employeeId',r.employee_id,'employeeName',e.display_name,
   'shiftDate',s.shift_date,'planned',r.planned,
   'requestedMinutes',r.requested_minutes,'reason',r.reason
 ) ORDER BY r.created_at),'[]'::jsonb)
 INTO result FROM public.overtime_requests r
 JOIN public.employees e ON e.id=r.employee_id
 JOIN public.shift_assignments s ON s.id=r.shift_assignment_id
 WHERE e.station_id=p_station_id AND r.status='pending';
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION hr_pending_overtime(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_pending_overtime(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_request_overtime(p_actor_id uuid, p_employee_id uuid, p_shift_id uuid, p_planned boolean, p_requested_minutes integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 e public.employees%ROWTYPE;
 v_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND employment_status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=e.station_id AND sm.module_code='hr_payroll' AND sm.status='enabled') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
   SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=e.station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_shift_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.shift_assignments a
    WHERE a.id=p_shift_id AND a.employee_id=e.id
      AND a.status IN ('scheduled','replaced','absence_review')
 ) OR p_planned IS NULL OR p_requested_minutes IS NULL
   OR p_requested_minutes<1 OR p_requested_minutes>960
   OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 4 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 INSERT INTO public.overtime_requests(id,employee_id,shift_assignment_id,planned,
   requested_minutes,reason,status)
 VALUES(v_id,e.id,p_shift_id,p_planned,p_requested_minutes,btrim(p_reason),'pending');
 RETURN jsonb_build_object('requestId',v_id,'status','pending',
   'requestedMinutes',p_requested_minutes,'planned',p_planned);
END $function$
;
REVOKE ALL ON FUNCTION hr_request_overtime(uuid,uuid,uuid,boolean,integer,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_request_overtime(uuid,uuid,uuid,boolean,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_request_shift_override(p_actor_id uuid, p_original_assignment_id uuid, p_new_template_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_orig public.shift_assignments%ROWTYPE;
 v_employee public.employees%ROWTYPE;v_template public.shift_templates%ROWTYPE;
 v_new_shift uuid:=gen_random_uuid();v_request_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO v_orig FROM public.shift_assignments
   WHERE id=p_original_assignment_id FOR UPDATE;
 IF NOT FOUND OR v_orig.status NOT IN ('scheduled','absence_review') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT';END IF;
 SELECT * INTO v_employee FROM public.employees WHERE id=v_orig.employee_id;
 SELECT * INTO v_template FROM public.shift_templates WHERE id=p_new_template_id AND active;
 IF v_template.station_id IS DISTINCT FROM v_employee.station_id
   OR v_orig.shift_template_id=p_new_template_id
   OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 4 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT (v_employee.user_id=p_actor_id OR EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=v_employee.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF EXISTS(SELECT 1 FROM public.shift_change_requests r
  WHERE r.original_assignment_id=p_original_assignment_id AND r.status='pending') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PENDING_REQUEST_EXISTS';
 END IF;
 IF EXISTS(SELECT 1 FROM public.shift_assignments a WHERE
   a.employee_id=v_orig.employee_id AND a.shift_date=v_orig.shift_date
   AND a.shift_template_id=p_new_template_id AND a.status<>'cancelled') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SHIFT_ALREADY_SCHEDULED';END IF;
 INSERT INTO public.shift_assignments(id,employee_id,shift_template_id,shift_date,status,
   replacement_of)
 VALUES(v_new_shift,v_orig.employee_id,p_new_template_id,v_orig.shift_date,
   'scheduled',v_orig.id);
 INSERT INTO public.shift_change_requests(id,employee_id,original_assignment_id,
  replacement_assignment_id,request_type,reason,status,requested_by)
 VALUES(v_request_id,v_orig.employee_id,v_orig.id,v_new_shift,'replace',btrim(p_reason),
  'pending',p_actor_id);
 UPDATE public.shift_assignments SET status='absence_review' WHERE id=v_orig.id;
 RETURN jsonb_build_object('requestId',v_request_id,'replacementAssignmentId',v_new_shift,
  'status','pending','originalAbsenceStatus','absence_review');
END $function$
;
REVOKE ALL ON FUNCTION hr_request_shift_override(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_request_shift_override(uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_review_shift_override(p_actor_id uuid, p_request_id uuid, p_approved boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_request public.shift_change_requests%ROWTYPE;
 v_station uuid;
BEGIN
 SELECT * INTO v_request FROM public.shift_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT station_id INTO v_station FROM public.employees WHERE id=v_request.employee_id;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND
   ((m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=v_station
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF v_request.status<>'pending' THEN
 RETURN jsonb_build_object('status',v_request.status,'replayed',true);END IF;
 IF p_approved IS NULL OR p_actor_id=v_request.requested_by THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='APPROVAL_NOT_ALLOWED';END IF;
 UPDATE public.shift_change_requests SET
 status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
 approved_by=p_actor_id,approved_at=clock_timestamp() WHERE id=p_request_id;
 IF p_approved THEN
   UPDATE public.shift_assignments SET status='replaced',approved_by=p_actor_id
   WHERE id=v_request.original_assignment_id;
 ELSE
   -- Preserve replacement attendance (if any) for manual payroll review.
   UPDATE public.shift_assignments SET status='absence_review'
    WHERE id=v_request.original_assignment_id;
   UPDATE public.shift_assignments SET status='absence_review'
    WHERE id=v_request.replacement_assignment_id;
 END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,v_station,'shift_change_request',p_request_id::text,
   CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
 RETURN jsonb_build_object('status',CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
  'replayed',false);
END $function$
;
REVOKE ALL ON FUNCTION hr_review_shift_override(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_review_shift_override(uuid,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_seed_shift_templates(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='station' AND m.station_id=p_station_id
     AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.station_modules WHERE station_id=p_station_id
   AND module_code='hr_payroll' AND status='enabled') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 INSERT INTO public.shift_templates(station_id,name,start_time,end_time,default_break_minutes)
 SELECT p_station_id, x.name, x.begins,x.ends,0 FROM (VALUES
  ('กะเช้า','06:00'::time,'14:00'::time),
  ('กะบ่าย','14:00'::time,'22:00'::time),
  ('กะดึก','22:00'::time,'06:00'::time)
 ) AS x(name,begins,ends)
 WHERE NOT EXISTS(SELECT 1 FROM public.shift_templates t
   WHERE t.station_id=p_station_id AND t.name=x.name);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('created',v_count);
END $function$
;
REVOKE ALL ON FUNCTION hr_seed_shift_templates(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_seed_shift_templates(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_station_pending_shift_changes(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id
     AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'requestId',r.id,'employeeId',r.employee_id,'employeeName',e.display_name,
  'originalAssignmentId',r.original_assignment_id,
  'originalShift',t1.name,'replacementShift',t2.name,
  'date',a.shift_date,'reason',r.reason,
  'requestedBy',r.requested_by,'status',r.status
 ) ORDER BY r.created_at),'[]'::jsonb)
 INTO result
 FROM public.shift_change_requests r
 JOIN public.employees e ON e.id=r.employee_id
 JOIN public.shift_assignments a ON a.id=r.original_assignment_id
 JOIN public.shift_assignments b ON b.id=r.replacement_assignment_id
 JOIN public.shift_templates t1 ON t1.id=a.shift_template_id
 JOIN public.shift_templates t2 ON t2.id=b.shift_template_id
 WHERE e.station_id=p_station_id AND r.status='pending';
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION hr_station_pending_shift_changes(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_station_pending_shift_changes(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hr_station_roster(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND (
    (m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id
       AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='organization' AND m.organization_id=
      (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
      AND m.role_code IN ('organization_owner','owner'))
 )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT jsonb_build_object(
  'employees',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'code',e.employee_code,'name',e.display_name,
    'employmentStatus',e.employment_status,'wageType',e.wage_type,
    'payrollFrequency',e.payroll_frequency) ORDER BY e.display_name),'[]'::jsonb)
    FROM public.employees e WHERE e.station_id=p_station_id),
  'shiftTemplates',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'startsAt',t.start_time::text,
    'endsAt',t.end_time::text,'breakMinutes',t.default_break_minutes)
    ORDER BY t.start_time),'[]'::jsonb)
    FROM public.shift_templates t WHERE t.station_id=p_station_id AND t.active),
  'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'employeeId',a.employee_id,'templateId',a.shift_template_id,
    'date',a.shift_date,'status',a.status) ORDER BY a.shift_date),'[]'::jsonb)
    FROM public.shift_assignments a
    JOIN public.employees e ON e.id=a.employee_id
    WHERE e.station_id=p_station_id AND a.shift_date>=current_date-7
      AND a.shift_date<=current_date+31)
 ) INTO result;
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION hr_station_roster(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hr_station_roster(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.inspect_station_coupon(p_actor_id uuid, p_qr_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.coupons%ROWTYPE; v_fuel text; v_station text;
BEGIN
 IF p_qr_hash IS NULL OR p_qr_hash !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QR';
 END IF;
 SELECT coupon.* INTO c FROM public.coupon_versions v
 JOIN public.coupons coupon ON coupon.id=v.coupon_id
 WHERE v.qr_payload_hash=p_qr_hash AND v.revoked_at IS NULL
 LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QR';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
  AND (
   (m.scope_type='station' AND m.station_id=c.station_id AND
     (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
       OR m.extra_permissions->>'start_fueling'='true'))
   OR (m.scope_type='organization' AND m.organization_id=
    (SELECT s.organization_id FROM public.stations s WHERE s.id=c.station_id)
    AND m.role_code IN ('organization_owner','owner'))
   )
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF c.status NOT IN ('reserved','verified') OR c.expires_at<=clock_timestamp() THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_NOT_AVAILABLE';END IF;
 SELECT s.name INTO v_station FROM public.stations s WHERE s.id=c.station_id;
 SELECT coalesce(p.name_th,f.custom_name) INTO v_fuel
 FROM public.station_fuel_products f
 LEFT JOIN public.brand_fuel_products p ON p.id=f.brand_product_id
 WHERE f.id=c.station_fuel_id;
 RETURN jsonb_build_object(
  'couponId',c.id,'stationId',c.station_id,'stationName',v_station,
  'fuelName',v_fuel,'status',c.status,
  'plateRequired',c.plate_snapshot IS NOT NULL,
  'plate',c.plate_snapshot,
  'maxAmountSatang',c.max_amount_satang::text,
  'expiresAt',c.expires_at
 );
END
$function$
;
REVOKE ALL ON FUNCTION inspect_station_coupon(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION inspect_station_coupon(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_reserved_coupon(p_coupon_id uuid, p_actor_id uuid, p_account_id uuid, p_station_fuel_id uuid, p_amount_satang bigint, p_expires_at timestamp with time zone, p_plate text, p_secret_hash text, p_qr_hash text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
REVOKE ALL ON FUNCTION issue_reserved_coupon(uuid,uuid,uuid,uuid,bigint,timestamp with time zone,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION issue_reserved_coupon(uuid,uuid,uuid,uuid,bigint,timestamp with time zone,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.pending_corporate_station_links(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'requestId',r.id,'companyId',r.company_id,'companyName',c.name,
  'stationId',r.station_id,'stationName',s.name,'requestedAt',r.requested_at
 ) ORDER BY r.requested_at),'[]'::jsonb)
 INTO result
 FROM public.corporate_station_link_requests r
 JOIN public.stations s ON s.id=r.station_id
 JOIN public.corporate_companies c ON c.id=r.company_id
 WHERE r.status='pending' AND EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company'
   AND m.corporate_company_id=r.company_id AND m.role_code='corporate_admin');
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION pending_corporate_station_links(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION pending_corporate_station_links(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_create_station(p_actor_id uuid, p_organization_name text, p_station_name text, p_brand_code text, p_enable_coupon boolean, p_enable_hr boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_org uuid:=gen_random_uuid();
 v_station uuid:=gen_random_uuid();
 v_brand uuid;
 v_added integer;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='platform' AND m.role_code='platform_superadmin'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_organization_name IS NULL OR char_length(btrim(p_organization_name)) NOT BETWEEN 2 AND 160
    OR p_station_name IS NULL OR char_length(btrim(p_station_name)) NOT BETWEEN 2 AND 160
    OR p_brand_code IS NULL OR p_enable_coupon IS NULL OR p_enable_hr IS NULL
    OR (NOT p_enable_coupon AND NOT p_enable_hr) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT b.id INTO v_brand FROM public.fuel_brands b
 WHERE b.code=p_brand_code AND b.active;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BRAND'; END IF;

 INSERT INTO public.organizations(id,name) VALUES(v_org,btrim(p_organization_name));
 INSERT INTO public.stations(id,organization_id,brand_id,name)
 VALUES(v_station,v_org,v_brand,btrim(p_station_name));
 INSERT INTO public.station_modules(station_id,module_code,status)
 VALUES(v_station,'qr_coupon',case when p_enable_coupon then 'enabled' else 'disabled' end),
       (v_station,'hr_payroll',case when p_enable_hr then 'enabled' else 'disabled' end);
 INSERT INTO public.station_fuel_products(station_id,brand_product_id,enabled,current_public_price)
 SELECT v_station,p.id,false,NULL FROM public.brand_fuel_products p
 WHERE p.brand_id=v_brand AND p.active AND p.code<>'CUSTOM'
   AND p.verification_status<>'retired';
 GET DIAGNOSTICS v_added=ROW_COUNT;
 INSERT INTO public.audit_events(actor_id,organization_id,station_id,entity_type,
 entity_id,action,after_state) VALUES(p_actor_id,v_org,v_station,'station',
 v_station::text,'station_created',jsonb_build_object(
  'brand_code',p_brand_code,'qr_coupon',p_enable_coupon,'hr_payroll',p_enable_hr));
 RETURN jsonb_build_object('id',v_station,'organizationId',v_org,
 'stationName',btrim(p_station_name),'brandCode',p_brand_code,
 'fuelProductsStaged',v_added,'couponModuleEnabled',p_enable_coupon,
 'hrModuleEnabled',p_enable_hr);
END $function$
;
REVOKE ALL ON FUNCTION platform_create_station(uuid,text,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION platform_create_station(uuid,text,text,text,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_station_overview(p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='platform'
   AND m.role_code='platform_superadmin') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'stationName',s.name,'organizationId',o.id,'organizationName',o.name,
 'brandCode',b.code,'brandName',b.display_name_th,
 'modules',(SELECT coalesce(jsonb_object_agg(sm.module_code,sm.status),'{}'::jsonb)
  FROM public.station_modules sm WHERE sm.station_id=s.id)
 ) ORDER BY s.created_at DESC),'[]'::jsonb)
 INTO result FROM public.stations s JOIN public.organizations o ON o.id=s.organization_id
 LEFT JOIN public.fuel_brands b ON b.id=s.brand_id;
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION platform_station_overview(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION platform_station_overview(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_station_plate_photo(p_actor_id uuid, p_station_id uuid, p_coupon_id uuid, p_photo_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
 PERFORM public.authorize_station_plate_upload(p_actor_id,p_station_id,p_coupon_id);
 IF p_photo_path IS NULL
   OR p_photo_path !~ ('^stations/'||p_station_id::text||'/plate/'||
        p_coupon_id::text||'/[0-9a-f-]{36}\.(jpg|png)$')
   OR NOT EXISTS(
     SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-evidence'
      AND o.name=p_photo_path
   ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE';END IF;
 INSERT INTO public.coupon_photo_checks(coupon_id,station_id,photo_path,captured_by,decision)
 VALUES(p_coupon_id,p_station_id,p_photo_path,p_actor_id,'pending')
 ON CONFLICT(coupon_id,photo_path) DO UPDATE SET photo_path=excluded.photo_path
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('photoId',v_id,'status','pending_ocr',
   'verified',false);
END $function$
;
REVOKE ALL ON FUNCTION record_station_plate_photo(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION record_station_plate_photo(uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_reserved_coupon(p_actor_id uuid, p_old_coupon_id uuid, p_new_coupon_id uuid, p_new_account_id uuid, p_new_station_fuel_id uuid, p_new_amount_satang bigint, p_new_expires_at timestamp with time zone, p_new_plate text, p_new_secret_hash text, p_new_qr_hash text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
REVOKE ALL ON FUNCTION replace_reserved_coupon(uuid,uuid,uuid,uuid,uuid,bigint,timestamp with time zone,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION replace_reserved_coupon(uuid,uuid,uuid,uuid,uuid,bigint,timestamp with time zone,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.request_corporate_station_link(p_actor_id uuid, p_station_id uuid, p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_org_id uuid; v_id uuid;
BEGIN
 SELECT organization_id INTO v_org_id FROM public.stations WHERE id=p_station_id;
 IF v_org_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.corporate_companies WHERE id=p_company_id AND status='active'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='organization' AND m.organization_id=v_org_id
    AND m.role_code IN ('organization_owner','owner'))
   OR (m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner','manager')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF EXISTS(SELECT 1 FROM public.corporate_station_accounts WHERE station_id=p_station_id AND company_id=p_company_id) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_LINKED'; END IF;
 INSERT INTO public.corporate_station_link_requests(station_id,company_id,requested_by)
 VALUES(p_station_id,p_company_id,p_actor_id)
 ON CONFLICT(station_id,company_id) DO UPDATE SET
  status='pending',requested_by=excluded.requested_by,requested_at=clock_timestamp(),
  reviewed_by=NULL,reviewed_at=NULL
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('requestId',v_id,'status','pending');
END $function$
;
REVOKE ALL ON FUNCTION request_corporate_station_link(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION request_corporate_station_link(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_corporate_topup(p_actor_id uuid, p_account_id uuid, p_station_bank_id uuid, p_amount_satang bigint, p_slip_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 PERFORM public.authorize_corporate_topup_upload(
  p_actor_id,p_account_id,p_station_bank_id,p_amount_satang);
 IF p_slip_path IS NULL OR p_slip_path !~
  ('^accounts/'||p_account_id::text||'/slips/'||
    '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'||
    '\.(jpg|png)$')
 OR NOT EXISTS(
  SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-slips'
   AND o.name=p_slip_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE'; END IF;
 INSERT INTO public.topup_requests(id,account_id,station_bank_id,amount_satang,
   slip_storage_path,requested_by,status)
 VALUES(v_id,p_account_id,p_station_bank_id,p_amount_satang,
   p_slip_path,p_actor_id,'pending');
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'topup_request',v_id::text,'topup_requested',
  jsonb_build_object('account_id',p_account_id,'amount_satang',p_amount_satang));
 RETURN jsonb_build_object('requestId',v_id,'status','pending',
   'verified',false,'addedPrepaidSatang','0');
END $function$
;
REVOKE ALL ON FUNCTION request_corporate_topup(uuid,uuid,uuid,bigint,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION request_corporate_topup(uuid,uuid,uuid,bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_coupon_link(p_coupon_id uuid, p_secret_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 c public.coupons%ROWTYPE;
 next_coupon public.coupons%ROWTYPE;
 station_name text;
 fuel_name text;
 n integer:=0;
BEGIN
 IF p_secret_hash IS NULL OR p_secret_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 SELECT * INTO c FROM public.coupons
  WHERE id=p_coupon_id AND secret_link_hash=p_secret_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 -- Follow replacement chain so a previously shared link displays the new QR.
 WHILE c.status='cancelled' AND n<10 LOOP
  SELECT child.* INTO next_coupon FROM public.coupons child
   JOIN public.corporate_station_accounts next_account
     ON next_account.id=child.account_id
   JOIN public.corporate_station_accounts original_account
     ON original_account.id=c.account_id
   WHERE child.replaces_coupon_id=c.id
     AND next_account.company_id=original_account.company_id
   ORDER BY child.issued_at DESC LIMIT 1;
  EXIT WHEN NOT FOUND;
  c:=next_coupon;
  n:=n+1;
 END LOOP;
 SELECT s.name INTO station_name FROM public.stations s WHERE s.id=c.station_id;
 SELECT coalesce(sp.name_override,sp.custom_name,p.name_th)
 INTO fuel_name
 FROM public.station_fuel_products sp LEFT JOIN public.brand_fuel_products p
 ON p.id=sp.brand_product_id WHERE sp.id=c.station_fuel_id;
 RETURN jsonb_build_object(
  'id',c.id,'status',case when c.expires_at<=clock_timestamp()
    AND c.status IN ('reserved','verified') THEN 'expired' ELSE c.status END,
  'expires_at',c.expires_at,
  'max_amount_satang',c.max_amount_satang::text,
  'station_name',station_name,
  'fuel_name',fuel_name,
  'replaced',c.id<>p_coupon_id
 );
END
$function$
;
REVOKE ALL ON FUNCTION resolve_coupon_link(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION resolve_coupon_link(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.review_corporate_topup(p_actor_id uuid, p_request_id uuid, p_approved boolean, p_bank_received boolean, p_verified_bank_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 t public.topup_requests%ROWTYPE;
 a public.corporate_station_accounts%ROWTYPE;
 v_remaining bigint;v_all_debt bigint;v_paid bigint:=0;
 v_payable bigint;v_ledger_prepaid bigint;
 v_ar public.accounts_receivable%ROWTYPE;
 v_ref text;
BEGIN
 SELECT * INTO t FROM public.topup_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=t.account_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=a.station_id
  AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
   OR m.extra_permissions->>'approve_topup'='true')) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF t.status<>'pending' THEN
  RETURN jsonb_build_object('requestId',t.id,'status',t.status,'replayed',true);
 END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT p_approved THEN
  UPDATE public.topup_requests SET status='rejected',reviewed_by=p_actor_id,
  reviewed_at=clock_timestamp() WHERE id=t.id;
  RETURN jsonb_build_object('requestId',t.id,'status','rejected','replayed',false);
 END IF;
 v_ref:=nullif(upper(btrim(p_verified_bank_reference)),'');
 IF p_bank_received IS DISTINCT FROM true OR v_ref IS NULL
  OR char_length(v_ref) NOT BETWEEN 6 AND 120 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BANK_CONFIRMATION_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.topup_requests old
  WHERE old.station_bank_id=t.station_bank_id AND old.status='approved'
   AND old.bank_reference=v_ref AND old.id<>t.id) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DUPLICATE_BANK_TRANSFER';END IF;
 SELECT coalesce(sum(ar.outstanding_satang),0)::bigint INTO v_all_debt
  FROM public.accounts_receivable ar WHERE ar.account_id=a.id;
 IF v_all_debt<>a.debt_outstanding_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DEBT_LEDGER_MISMATCH';END IF;
 v_remaining:=t.amount_satang;
 FOR v_ar IN
  SELECT * FROM public.accounts_receivable ar
  WHERE ar.account_id=a.id AND ar.outstanding_satang>0
  ORDER BY ar.due_at NULLS LAST,ar.created_at,ar.id FOR UPDATE
 LOOP
  EXIT WHEN v_remaining<=0;
  v_payable:=least(v_remaining,v_ar.outstanding_satang);
  UPDATE public.accounts_receivable SET
   outstanding_satang=outstanding_satang-v_payable WHERE id=v_ar.id;
  v_remaining:=v_remaining-v_payable;
  v_paid:=v_paid+v_payable;
 END LOOP;
 v_ledger_prepaid:=v_remaining;
 UPDATE public.corporate_station_accounts SET
  prepaid_balance_satang=prepaid_balance_satang+v_ledger_prepaid,
  debt_outstanding_satang=debt_outstanding_satang-v_paid
 WHERE id=a.id;
 UPDATE public.topup_requests SET status='approved',bank_reference=v_ref,
  reviewed_by=p_actor_id,reviewed_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_prepaid_satang,
  delta_debt_satang,reference_type,reference_id)
 VALUES(a.id,'topup_approved',v_ledger_prepaid,-v_paid,'topup',t.id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,a.station_id,'topup_request',t.id::text,'topup_approved',
  jsonb_build_object('amount_satang',t.amount_satang,
   'paid_debt_satang',v_paid,'added_prepaid_satang',v_remaining));
 RETURN jsonb_build_object('requestId',t.id,'status','approved','replayed',false,
  'paidDebtSatang',v_paid,'addedPrepaidSatang',v_remaining);
END $function$
;
REVOKE ALL ON FUNCTION review_corporate_topup(uuid,uuid,boolean,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION review_corporate_topup(uuid,uuid,boolean,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.review_verified_corporate_topup(p_actor_id uuid, p_request_id uuid, p_approved boolean, p_bank_received boolean, p_verified_bank_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.topup_requests%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.topup_requests
  WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_approved AND (t.requested_by=p_actor_id OR t.requested_by IS NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';
 END IF;
 IF p_approved AND (p_bank_received IS DISTINCT FROM true
  OR p_verified_bank_reference IS NULL
  OR length(btrim(p_verified_bank_reference)) NOT BETWEEN 6 AND 120)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BANK_CONFIRMATION_REQUIRED';END IF;
 IF p_approved AND NOT EXISTS(
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='oilstation-slips' AND o.name=t.slip_storage_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE';END IF;
 RETURN public.review_corporate_topup(p_actor_id,p_request_id,
  p_approved,p_bank_received,p_verified_bank_reference);
END $function$
;
REVOKE ALL ON FUNCTION review_verified_corporate_topup(uuid,uuid,boolean,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION review_verified_corporate_topup(uuid,uuid,boolean,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.start_reserved_fuel_session(p_actor_id uuid, p_coupon_id uuid, p_verified_plate text, p_plate_photo_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
REVOKE ALL ON FUNCTION start_reserved_fuel_session(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION start_reserved_fuel_session(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.station_create_corporate_customer(p_actor_id uuid, p_station_id uuid, p_name text, p_tax_id text, p_contact_email text, p_payment_terms_days integer, p_due_mode text, p_statement_close_day integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_org_id uuid; v_company_id uuid:=gen_random_uuid();
 v_account_id uuid:=gen_random_uuid();
 v_clean_tax text:=nullif(regexp_replace(coalesce(p_tax_id,''),'[^0-9]','','g'),'');
BEGIN
 SELECT organization_id INTO v_org_id FROM public.stations WHERE id=p_station_id;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM public.station_modules sm WHERE sm.station_id=p_station_id
   AND sm.module_code='qr_coupon' AND sm.status='enabled'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STATION_NOT_AVAILABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active AND m.user_id=p_actor_id
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='organization' AND m.organization_id=v_org_id
     AND m.role_code IN ('organization_owner','owner'))
   OR (m.scope_type='station' AND m.station_id=p_station_id
     AND (m.role_code IN ('station_owner','owner','manager')
       OR m.extra_permissions->>'manage_corporate_customers'='true')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 200
  OR (p_tax_id IS NOT NULL AND (char_length(p_tax_id)>32 OR (v_clean_tax IS NOT NULL AND char_length(v_clean_tax)<>13)))
  OR (p_contact_email IS NOT NULL AND (length(p_contact_email)>320
    OR p_contact_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  OR p_payment_terms_days NOT BETWEEN 0 AND 365
  OR p_due_mode NOT IN ('per_fill','statement')
  OR (p_due_mode='statement' AND p_statement_close_day IS NULL)
  OR (p_statement_close_day IS NOT NULL AND p_statement_close_day NOT BETWEEN 1 AND 31)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 IF v_clean_tax IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.corporate_companies c WHERE c.tax_id=v_clean_tax) THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='COMPANY_ALREADY_EXISTS';
 END IF;
 INSERT INTO public.corporate_companies(id,name,tax_id,contact_email)
 VALUES(v_company_id,btrim(p_name),v_clean_tax,nullif(lower(btrim(p_contact_email)),''));
 INSERT INTO public.corporate_station_accounts(id,station_id,company_id,
  due_mode,payment_terms_days,statement_close_day)
 VALUES(v_account_id,p_station_id,v_company_id,p_due_mode,p_payment_terms_days,p_statement_close_day);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'corporate_company',v_company_id::text,
  'corporate_customer_created',jsonb_build_object('account_id',v_account_id));
 RETURN jsonb_build_object('companyId',v_company_id,'accountId',v_account_id,
  'stationId',p_station_id,'name',btrim(p_name));
END $function$
;
REVOKE ALL ON FUNCTION station_create_corporate_customer(uuid,uuid,text,text,text,integer,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION station_create_corporate_customer(uuid,uuid,text,text,text,integer,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.station_fuel_inventory(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND (
    (m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id AND
      (m.role_code IN ('station_owner','owner','manager')
        OR m.extra_permissions->>'manage_fuel_prices'='true'))
    OR (m.scope_type='organization' AND m.organization_id=
      (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
      AND m.role_code IN ('organization_owner','owner'))
  )
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',f.id,
  'stationId',f.station_id,
  'name',coalesce(f.name_override,f.custom_name,p.name_th),
  'brandProductCode',p.code,
  'enabled',f.enabled,
  'publicPrice',f.current_public_price::text
 ) ORDER BY coalesce(f.name_override,f.custom_name,p.name_th)),'[]'::jsonb)
 INTO result
 FROM public.station_fuel_products f
 LEFT JOIN public.brand_fuel_products p ON p.id=f.brand_product_id
 WHERE f.station_id=p_station_id;
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION station_fuel_inventory(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION station_fuel_inventory(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.station_invite_first_corporate_admin(p_actor_id uuid, p_station_id uuid, p_company_id uuid, p_email text, p_token_hash text, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_organization_id uuid;v_id uuid:=gen_random_uuid();
BEGIN
 SELECT organization_id INTO v_organization_id FROM public.stations WHERE id=p_station_id;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.corporate_station_accounts a
   WHERE a.station_id=p_station_id AND a.company_id=p_company_id) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND (
     (m.scope_type='platform' AND m.role_code='platform_superadmin')
     OR (m.scope_type='organization' AND m.organization_id=v_organization_id
       AND m.role_code IN ('organization_owner','owner'))
     OR (m.scope_type='station' AND m.station_id=p_station_id
       AND m.role_code IN ('station_owner','owner'))
   )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_email IS NULL OR p_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
   OR length(p_email)>320
   OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR p_expires_at<=clock_timestamp()
   OR p_expires_at>clock_timestamp()+interval '30 days' THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Protect the first-admin slot against parallel invitations from two stations
 -- of the same corporate company, without using client-supplied locking keys.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
 IF EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.corporate_company_id=p_company_id AND m.active
     AND m.scope_type='corporate_company' AND m.role_code='corporate_admin'
 ) OR EXISTS(SELECT 1 FROM public.invitations i
   WHERE i.corporate_company_id=p_company_id
   AND i.role_code='corporate_admin' AND i.scope_type='corporate_company'
   AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>clock_timestamp()
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ADMIN_ALREADY_INVITED';END IF;
 INSERT INTO public.invitations(id,email,token_hash,role_code,scope_type,
  corporate_company_id,invited_by,expires_at)
 VALUES(v_id,lower(btrim(p_email)),p_token_hash,'corporate_admin','corporate_company',
  p_company_id,p_actor_id,p_expires_at);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'invitation',v_id::text,'first_corporate_admin_invited',
  jsonb_build_object('company_id',p_company_id));
 RETURN jsonb_build_object('id',v_id,'email',lower(btrim(p_email)),
   'role','corporate_admin','scopeType','corporate_company','expiresAt',p_expires_at);
END $function$
;
REVOKE ALL ON FUNCTION station_invite_first_corporate_admin(uuid,uuid,uuid,text,text,timestamp with time zone) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION station_invite_first_corporate_admin(uuid,uuid,uuid,text,text,timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.station_pending_topup_inbox(p_actor_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
      AND m.scope_type='station' AND m.station_id=p_station_id
      AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
        OR m.extra_permissions->>'approve_topup'='true')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'requestId',t.id,'accountId',t.account_id,'companyName',c.name,
    'bankCode',b.bank_code,'amountSatang',t.amount_satang::text,
    'status',t.status,'requestedAt',t.created_at,
    'evidencePath',t.slip_storage_path
  ) ORDER BY t.created_at ASC,t.id),'[]'::jsonb) INTO result
  FROM public.topup_requests t
  JOIN public.corporate_station_accounts a ON a.id=t.account_id
  JOIN public.corporate_companies c ON c.id=a.company_id
  JOIN public.station_bank_accounts b ON b.id=t.station_bank_id
  WHERE a.station_id=p_station_id AND t.status='pending';
  RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION station_pending_topup_inbox(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION station_pending_topup_inbox(uuid,uuid) TO service_role;

