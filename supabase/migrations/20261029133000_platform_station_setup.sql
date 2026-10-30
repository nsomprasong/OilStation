-- Platform-controlled station provisioning. Fuel products are copied as
-- disabled, unpriced selections; station owners must explicitly enable/price.
CREATE OR REPLACE FUNCTION public.platform_create_station(
 p_actor_id uuid, p_organization_name text, p_station_name text,
 p_brand_code text, p_enable_coupon boolean, p_enable_hr boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_station_overview(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
END $fn$;

REVOKE ALL ON FUNCTION public.platform_create_station(uuid,text,text,text,boolean,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_station_overview(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_create_station(uuid,text,text,text,boolean,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_station_overview(uuid) TO service_role;
