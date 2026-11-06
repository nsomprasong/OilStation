-- Pure target-module quote for pending SaaS replacement; no module status writes.
CREATE OR REPLACE FUNCTION public.station_plan_quote_for_modules(p_station_id uuid, p_plan_id uuid, p_method text, p_target_modules text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF p_target_modules IS NULL OR cardinality(p_target_modules) NOT BETWEEN 1 AND 2 OR
   EXISTS(SELECT 1 FROM unnest(p_target_modules) AS x(code)
     WHERE x.code IS NULL OR x.code NOT IN ('qr_coupon','hr_payroll')) OR
   cardinality(p_target_modules)<>(SELECT count(DISTINCT x.code)
     FROM unnest(p_target_modules) AS x(code))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_modules:=cardinality(p_target_modules);
 IF v_modules=0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 WITH priced AS (
  SELECT sm.module_code,
    (SELECT pr.price_satang FROM public.pricing_rules pr
      WHERE pr.plan_id=p_plan_id AND pr.module_code=sm.module_code
       AND pr.billing_method='flat'
       AND pr.effective_at<=clock_timestamp()
       AND (pr.expires_at IS NULL OR pr.expires_at>clock_timestamp())
      ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1) price
  FROM unnest(p_target_modules) AS sm(module_code)
 )
 SELECT count(price),coalesce(sum(price),0),
    coalesce(sum(price) FILTER(WHERE module_code='qr_coupon'),0),
    coalesce(sum(price) FILTER(WHERE module_code='hr_payroll'),0)
 INTO v_covered,v_subtotal,v_coupon,v_hr FROM priced;
 -- Apply the explicit combined-module price only when BOTH modules are active.
 -- Older plans without a bundle retain their original additive pricing.
 IF v_modules=2 AND 'qr_coupon'=ANY(p_target_modules)
   AND 'hr_payroll'=ANY(p_target_modules) THEN
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
END $function$;

REVOKE ALL ON FUNCTION public.station_plan_quote_for_modules(uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_plan_quote_for_modules(uuid,uuid,text,text[]) TO service_role;
