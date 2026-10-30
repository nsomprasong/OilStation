-- Corporate workspaces use server-only RPCs. Every returned account is
-- authorized from memberships stored in the database; station identifiers
-- supplied by a browser cannot expand the result.
CREATE OR REPLACE FUNCTION public.corporate_account_summaries(
 p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.corporate_account_fuel_offers(
 p_actor_id uuid,p_account_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.corporate_account_summaries(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.corporate_account_fuel_offers(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.corporate_account_summaries(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.corporate_account_fuel_offers(uuid,uuid) TO service_role;
