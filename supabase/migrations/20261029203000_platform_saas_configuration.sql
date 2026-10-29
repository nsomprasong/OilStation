-- Reviewed platform-owned SaaS billing configuration. Test rollout only.
-- No default tax assumption; tax policy must be explicitly reviewed.
CREATE TABLE IF NOT EXISTS public.saas_tax_review_policies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vat_mode text NOT NULL CHECK(vat_mode IN ('inclusive','exclusive')),
 rate_basis_points integer NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 effective_on date NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.app_users(id),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.saas_tax_review_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_tax_review_policies FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_tax_review_policies FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS saas_tax_policy_effective_idx
 ON public.saas_tax_review_policies(effective_on DESC,approved_at DESC);

CREATE OR REPLACE FUNCTION public.platform_define_saas_flat_plan(
 p_actor_id uuid,p_code text,p_name text,p_frequency text,
 p_coupon_price_satang bigint,p_hr_price_satang bigint,p_effective_on date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform'
   AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_code IS NULL OR p_code !~ '^[a-z][a-z0-9_-]{2,39}$'
   OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 120
   OR p_frequency NOT IN ('monthly','yearly')
   OR p_coupon_price_satang NOT BETWEEN 0 AND 99999999
   OR p_hr_price_satang NOT BETWEEN 0 AND 99999999
   OR p_coupon_price_satang+p_hr_price_satang<1000
   OR p_effective_on IS NULL OR p_effective_on<'2025-01-01'::date
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.pricing_plans(id,code,name,billing_frequency,active)
 VALUES(v_id,p_code,btrim(p_name),p_frequency,true);
 INSERT INTO public.pricing_rules(plan_id,module_code,billing_method,
    price_satang,configuration,effective_at)
 VALUES(v_id,'qr_coupon','flat',p_coupon_price_satang,
   jsonb_build_object('reviewedBy',p_actor_id,'source','platform_settings'),p_effective_on::timestamptz),
       (v_id,'hr_payroll','flat',p_hr_price_satang,
   jsonb_build_object('reviewedBy',p_actor_id,'source','platform_settings'),p_effective_on::timestamptz);
 RETURN jsonb_build_object('planId',v_id,'status','configured','currency','thb');
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_review_saas_tax_policy(
 p_actor_id uuid,p_vat_mode text,p_rate_basis_points integer,p_effective_on date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_vat_mode NOT IN ('inclusive','exclusive') OR
    p_rate_basis_points NOT BETWEEN 0 AND 10000 OR p_effective_on IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.saas_tax_review_policies(vat_mode,rate_basis_points,
    effective_on,approved_by) VALUES(
    p_vat_mode,p_rate_basis_points,p_effective_on,p_actor_id) RETURNING id INTO v_id;
 RETURN jsonb_build_object('policyId',v_id,'reviewed',true);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_create_saas_billing_group(
 p_actor_id uuid,p_organization_id uuid,p_name text,p_station_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid:=gen_random_uuid();v_station uuid;v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120
   OR p_organization_id IS NULL OR p_station_ids IS NULL OR
   cardinality(p_station_ids) NOT BETWEEN 1 AND 50 OR
   (SELECT count(DISTINCT x) FROM unnest(p_station_ids) AS x)
        <>cardinality(p_station_ids)
   OR EXISTS(SELECT 1 FROM unnest(p_station_ids) AS x WHERE x IS NULL)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Prevent a group containing a station from a different organization.
 SELECT count(*) INTO v_count FROM public.stations s
  WHERE s.organization_id=p_organization_id AND s.id=ANY(p_station_ids);
 IF v_count<>cardinality(p_station_ids)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.billing_groups(id,organization_id,name,autopay_consent,status)
 VALUES(v_id,p_organization_id,btrim(p_name),false,'active');
 FOREACH v_station IN ARRAY p_station_ids LOOP
   INSERT INTO public.billing_group_stations(billing_group_id,station_id)
     VALUES(v_id,v_station);
 END LOOP;
 RETURN jsonb_build_object('billingGroupId',v_id,'stationCount',v_count,
  'autopayConsent',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_subscribe_saas_station(
 p_actor_id uuid,p_station_id uuid,p_plan_id uuid,
 p_starts_at timestamptz,p_period_end timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
    AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_starts_at IS NULL OR p_period_end IS NULL OR
   p_period_end<=p_starts_at OR p_period_end>p_starts_at+interval '370 days'
   OR NOT EXISTS(SELECT 1 FROM public.billing_group_stations bgs
    WHERE bgs.station_id=p_station_id)
   OR NOT EXISTS(SELECT 1 FROM public.pricing_plans p
    WHERE p.id=p_plan_id AND p.active)
   OR EXISTS(SELECT 1 FROM public.station_subscriptions ss
    WHERE ss.station_id=p_station_id AND ss.status IN
      ('trialing','active','grace','overdue'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.station_subscriptions(
   id,station_id,plan_id,starts_at,current_period_end,status)
 VALUES(v_id,p_station_id,p_plan_id,p_starts_at,p_period_end,'trialing');
 RETURN jsonb_build_object('subscriptionId',v_id,'status','trialing');
END $fn$;

REVOKE ALL ON FUNCTION public.platform_define_saas_flat_plan(
 uuid,text,text,text,bigint,bigint,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_review_saas_tax_policy(
 uuid,text,integer,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_create_saas_billing_group(
 uuid,uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_subscribe_saas_station(
 uuid,uuid,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_define_saas_flat_plan(
 uuid,text,text,text,bigint,bigint,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_review_saas_tax_policy(
 uuid,text,integer,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_create_saas_billing_group(
 uuid,uuid,text,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_subscribe_saas_station(
 uuid,uuid,uuid,timestamptz,timestamptz) TO service_role;
