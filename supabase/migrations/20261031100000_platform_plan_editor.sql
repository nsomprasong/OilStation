-- Plan editor: allow in-place updates only before any historical customer linkage.
-- Once referenced, an existing plan is immutable; create a replacement instead.
-- No direct Data API grants; only the trusted Worker service role may call these RPCs.
CREATE OR REPLACE FUNCTION public.platform_saas_plan_editor(
 p_actor_id uuid,p_plan_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_plan record;
 v_coupon bigint;
 v_hr bigint;
 v_bundle bigint;
 v_effective_on date;
 v_can_edit boolean;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='platform' AND m.role_code='platform_superadmin'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 SELECT p.id,p.code,p.name,p.billing_frequency,p.active INTO v_plan
 FROM public.pricing_plans p WHERE p.id=p_plan_id;
 IF NOT FOUND OR v_plan.active IS DISTINCT FROM true
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 SELECT
  max(pr.price_satang) FILTER(WHERE pr.module_code='qr_coupon' AND pr.billing_method='flat'),
  max(pr.price_satang) FILTER(WHERE pr.module_code='hr_payroll' AND pr.billing_method='flat'),
  max(pr.price_satang) FILTER(WHERE pr.module_code IS NULL AND pr.billing_method='bundle'),
  min(pr.effective_at::date)
 INTO v_coupon,v_hr,v_bundle,v_effective_on
 FROM public.pricing_rules pr WHERE pr.plan_id=p_plan_id;
 v_can_edit:=(
  (SELECT count(*)=3 FROM public.pricing_rules pr WHERE pr.plan_id=p_plan_id)
  AND v_coupon IS NOT NULL AND v_hr IS NOT NULL AND v_bundle IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.station_subscriptions s WHERE s.plan_id=p_plan_id)
  AND NOT EXISTS(SELECT 1 FROM public.station_plan_checkout_requests r WHERE r.plan_id=p_plan_id)
 );
 RETURN jsonb_build_object('planId',v_plan.id,'code',v_plan.code,'name',v_plan.name,
  'frequency',v_plan.billing_frequency,'couponPriceSatang',v_coupon,
  'hrPriceSatang',v_hr,'bundlePriceSatang',v_bundle,
  'effectiveOn',to_char(v_effective_on,'YYYY-MM-DD'),'canEdit',v_can_edit);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_edit_saas_bundle_plan(
 p_actor_id uuid,p_plan_id uuid,p_code text,p_name text,p_frequency text,
 p_coupon_price_satang bigint,p_hr_price_satang bigint,
 p_bundle_price_satang bigint,p_effective_on date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_active boolean;v_rules integer;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='platform' AND m.role_code='platform_superadmin'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_code IS NULL OR p_code !~ '^[a-z][a-z0-9_-]{2,39}$'
  OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 120
  OR p_frequency NOT IN ('monthly','yearly')
  OR p_coupon_price_satang NOT BETWEEN 0 AND 99999999
  OR p_hr_price_satang NOT BETWEEN 0 AND 99999999
  OR p_bundle_price_satang NOT BETWEEN 1000 AND 99999999
  OR p_coupon_price_satang+p_hr_price_satang<1000
  OR p_effective_on IS NULL OR p_effective_on<'2025-01-01'::date
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;

 -- Lock before checking customers. FK checks must not race with edits.
 SELECT p.active INTO v_active FROM public.pricing_plans p WHERE p.id=p_plan_id FOR UPDATE;
 IF NOT FOUND OR v_active IS DISTINCT FROM true
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF EXISTS(SELECT 1 FROM public.station_subscriptions s WHERE s.plan_id=p_plan_id)
    OR EXISTS(SELECT 1 FROM public.station_plan_checkout_requests r WHERE r.plan_id=p_plan_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLAN_IN_USE';END IF;
 IF EXISTS(SELECT 1 FROM public.pricing_plans p WHERE p.code=p_code AND p.id<>p_plan_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;

 SELECT count(*) INTO v_rules FROM public.pricing_rules pr WHERE pr.plan_id=p_plan_id
  AND ((pr.module_code='qr_coupon' AND pr.billing_method='flat')
   OR (pr.module_code='hr_payroll' AND pr.billing_method='flat')
   OR (pr.module_code IS NULL AND pr.billing_method='bundle'));
 IF v_rules<>3 OR (SELECT count(*) FROM public.pricing_rules pr WHERE pr.plan_id=p_plan_id)<>3
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.pricing_plans
  SET code=p_code,name=btrim(p_name),billing_frequency=p_frequency
  WHERE id=p_plan_id;
 UPDATE public.pricing_rules
  SET price_satang=CASE
   WHEN module_code='qr_coupon' THEN p_coupon_price_satang
   WHEN module_code='hr_payroll' THEN p_hr_price_satang
   ELSE p_bundle_price_satang END,
   effective_at=p_effective_on::timestamptz,
   configuration=configuration||jsonb_build_object('reviewedBy',p_actor_id,'editedAt',clock_timestamp())
  WHERE plan_id=p_plan_id;
 RETURN jsonb_build_object('planId',p_plan_id,'updated',true);
END $fn$;

REVOKE ALL ON FUNCTION public.platform_saas_plan_editor(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_saas_plan_editor(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.platform_edit_saas_bundle_plan(
 uuid,uuid,text,text,text,bigint,bigint,bigint,date)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_edit_saas_bundle_plan(
 uuid,uuid,text,text,text,bigint,bigint,bigint,date) TO service_role;
