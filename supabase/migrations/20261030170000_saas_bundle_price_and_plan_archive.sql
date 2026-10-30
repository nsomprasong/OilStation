-- Store a third price for BOTH QR Coupon + HR & Payroll.
-- Use the existing pricing_rules flat/bundle discriminator; no new table needed.
-- Older plans keep their previous additive price when no bundle rule exists.

CREATE OR REPLACE FUNCTION public.platform_define_saas_bundle_plan(
 p_actor_id uuid,p_code text,p_name text,p_frequency text,
 p_coupon_price_satang bigint,p_hr_price_satang bigint,
 p_bundle_price_satang bigint,p_effective_on date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_result jsonb;v_id uuid;
BEGIN
 IF p_bundle_price_satang NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Existing RPC keeps its role enforcement and validation.
 v_result:=public.platform_define_saas_flat_plan(
  p_actor_id,p_code,p_name,p_frequency,
  p_coupon_price_satang,p_hr_price_satang,p_effective_on);
 v_id:=(v_result->>'planId')::uuid;
 INSERT INTO public.pricing_rules(plan_id,module_code,billing_method,
  price_satang,configuration,effective_at)
 VALUES(v_id,NULL,'bundle',p_bundle_price_satang,
  jsonb_build_object('source','platform_settings','reviewedBy',p_actor_id,
    'bundleModules',jsonb_build_array('qr_coupon','hr_payroll')),
  p_effective_on::timestamptz);
 RETURN v_result||jsonb_build_object('bundlePriceSatang',p_bundle_price_satang);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_archive_saas_plan(
 p_actor_id uuid,p_plan_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_exists boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT active INTO v_exists FROM public.pricing_plans p WHERE p.id=p_plan_id FOR UPDATE;
 IF NOT FOUND OR v_exists=false
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF EXISTS(SELECT 1 FROM public.station_subscriptions s
    WHERE s.plan_id=p_plan_id AND s.status IN ('trialing','active','grace','overdue'))
 OR EXISTS(SELECT 1 FROM public.station_plan_checkout_requests r
    WHERE r.plan_id=p_plan_id AND r.status='pending_payment')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLAN_IN_USE';END IF;
 -- Archive, not hard-delete: preserve invoices, pricing rules and history.
 UPDATE public.pricing_plans SET active=false WHERE id=p_plan_id;
 RETURN jsonb_build_object('archived',true,'planId',p_plan_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.station_plan_pricing(
 p_station_id uuid,p_plan_id uuid,p_method text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_modules integer;
 v_covered integer;
 v_subtotal bigint;
 v_coupon bigint;
 v_hr bigint;
 v_vat_mode text;
 v_rate integer;
 v_discount bigint;
 v_net bigint;
 v_tax bigint;
 v_total bigint;
 v_bundle bigint;
 v_bundle_applied boolean:=false;
BEGIN
 IF p_method NOT IN ('card','promptpay') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pricing_plans p
   WHERE p.id=p_plan_id AND p.active) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT count(*) INTO v_modules FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.status='enabled';
 IF v_modules=0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 WITH priced AS (
  SELECT sm.module_code,
    (SELECT pr.price_satang FROM public.pricing_rules pr
      WHERE pr.plan_id=p_plan_id AND pr.module_code=sm.module_code
       AND pr.billing_method='flat'
       AND pr.effective_at<=clock_timestamp()
       AND (pr.expires_at IS NULL OR pr.expires_at>clock_timestamp())
      ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1) price
  FROM public.station_modules sm
  WHERE sm.station_id=p_station_id AND sm.status='enabled'
 )
 SELECT count(price),coalesce(sum(price),0),
    coalesce(sum(price) FILTER(WHERE module_code='qr_coupon'),0),
    coalesce(sum(price) FILTER(WHERE module_code='hr_payroll'),0)
 INTO v_covered,v_subtotal,v_coupon,v_hr FROM priced;
 -- Apply the explicit combined-module price only when BOTH modules are active.
 -- Older plans without a bundle retain their original additive pricing.
 IF v_modules=2 AND EXISTS(SELECT 1 FROM public.station_modules sm
    WHERE sm.station_id=p_station_id AND sm.status='enabled'
      AND sm.module_code='qr_coupon')
  AND EXISTS(SELECT 1 FROM public.station_modules sm
    WHERE sm.station_id=p_station_id AND sm.status='enabled'
      AND sm.module_code='hr_payroll') THEN
   SELECT pr.price_satang INTO v_bundle FROM public.pricing_rules pr
   WHERE pr.plan_id=p_plan_id AND pr.module_code IS NULL
      AND pr.billing_method='bundle'
      AND pr.effective_at<=clock_timestamp()
      AND (pr.expires_at IS NULL OR pr.expires_at>clock_timestamp())
   ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1;
   IF FOUND THEN v_subtotal:=v_bundle;v_bundle_applied:=true; END IF;
 END IF;
 IF v_covered<>v_modules OR v_subtotal NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRICE_RULE_UNAVAILABLE';END IF;
 SELECT vat_mode,rate_basis_points INTO v_vat_mode,v_rate
 FROM public.saas_tax_review_policies
 WHERE effective_on<=CURRENT_DATE
 ORDER BY effective_on DESC,approved_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='TAX_POLICY_REQUIRED';
 END IF;
 v_discount:=CASE WHEN p_method='promptpay' THEN round(v_subtotal::numeric*2/100)::bigint ELSE 0 END;
 v_net:=v_subtotal-v_discount;
 v_tax:=CASE WHEN v_vat_mode='exclusive'
   THEN round(v_net::numeric*v_rate/10000)::bigint
   ELSE round(v_net::numeric*v_rate/(10000+v_rate))::bigint END;
 v_total:=CASE WHEN v_vat_mode='exclusive' THEN v_net+v_tax ELSE v_net END;
 RETURN jsonb_build_object('subtotalSatang',v_subtotal,'couponSatang',v_coupon,
   'hrSatang',v_hr,'discountSatang',v_discount,'taxSatang',v_tax,
   'totalSatang',v_total,'vatMode',v_vat_mode,'rateBasisPoints',v_rate,
   'paymentMethod',p_method,'planId',p_plan_id,
   'bundleApplied',v_bundle_applied,'bundlePriceSatang',CASE WHEN v_bundle_applied THEN v_bundle ELSE NULL END);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_saas_billing_overview(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN jsonb_build_object(
  'organizations',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',o.id,'name',o.name) ORDER BY o.name)
   FROM(SELECT id,name FROM public.organizations ORDER BY name LIMIT 100) o),'[]'::jsonb),
  'stations',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',s.id,'name',s.name,'organizationId',s.organization_id,
   'moduleCodes',(SELECT coalesce(jsonb_agg(sm.module_code ORDER BY sm.module_code),'[]'::jsonb)
     FROM public.station_modules sm WHERE sm.station_id=s.id AND sm.status='enabled'))
    ORDER BY s.name)
   FROM(SELECT id,name,organization_id FROM public.stations ORDER BY name LIMIT 200) s),'[]'::jsonb),
  'plans',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',p.id,'code',p.code,'name',p.name,'frequency',p.billing_frequency,
   'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('moduleCode',pr.module_code,
      'priceSatang',pr.price_satang,'billingMethod',pr.billing_method) ORDER BY pr.module_code),'[]'::jsonb)
     FROM public.pricing_rules pr WHERE pr.plan_id=p.id)) ORDER BY p.created_at DESC)
   FROM(SELECT * FROM public.pricing_plans WHERE active ORDER BY created_at DESC LIMIT 100) p),'[]'::jsonb),
  'groups',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'organizationId',g.organization_id,
    'stationIds',(SELECT coalesce(jsonb_agg(bgs.station_id ORDER BY bgs.station_id),'[]'::jsonb)
      FROM public.billing_group_stations bgs WHERE bgs.billing_group_id=g.id))
      ORDER BY g.created_at DESC)
    FROM(SELECT * FROM public.billing_groups ORDER BY created_at DESC LIMIT 100) g),'[]'::jsonb),
  'subscriptions',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'stationId',s.station_id,'planId',s.plan_id,'status',s.status,
    'periodEnd',s.current_period_end) ORDER BY s.created_at DESC)
    FROM(SELECT * FROM public.station_subscriptions ORDER BY created_at DESC LIMIT 200) s),'[]'::jsonb),
  'taxPolicy',(SELECT jsonb_build_object('id',t.id,'vatMode',t.vat_mode,
    'rateBasisPoints',t.rate_basis_points,'effectiveOn',t.effective_on,
    'approvedAt',t.approved_at) FROM public.saas_tax_review_policies t
    ORDER BY t.effective_on DESC,t.approved_at DESC LIMIT 1),
  'invoices',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'invoiceId',i.id,'number',i.invoice_number,'status',i.status,
    'billingGroupId',i.billing_group_id,'amountSatang',i.total_satang,
    'paymentMethod',i.pricing_snapshot->>'paymentMethod',
    'serviceStart',i.pricing_snapshot->>'serviceStart',
    'serviceEnd',i.pricing_snapshot->>'serviceEnd',
    'lines',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'lineId',l.id,'stationId',l.station_id,'moduleCode',l.module_code,
      'amountSatang',l.amount_satang,'discountSatang',l.discount_satang)
       ORDER BY l.id),'[]'::jsonb)
      FROM public.saas_invoice_lines l WHERE l.invoice_id=i.id))
      ORDER BY i.created_at DESC)
    FROM(SELECT * FROM public.saas_invoices ORDER BY created_at DESC LIMIT 60) i),'[]'::jsonb)
 );
END $fn$;

REVOKE ALL ON FUNCTION public.platform_define_saas_bundle_plan(
 uuid,text,text,text,bigint,bigint,bigint,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_define_saas_bundle_plan(
 uuid,text,text,text,bigint,bigint,bigint,date) TO service_role;
REVOKE ALL ON FUNCTION public.platform_archive_saas_plan(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_archive_saas_plan(uuid,uuid) TO service_role;

-- Updated pre-existing SQL functions retain the same service-role-only ACL.
REVOKE ALL ON FUNCTION public.station_plan_pricing(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_plan_pricing(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.platform_saas_billing_overview(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_saas_billing_overview(uuid) TO service_role;
