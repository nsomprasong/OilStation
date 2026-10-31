-- Sales users open their own stations. This migration is additive and leaves
-- the original Super Admin station-create function unchanged.
-- Every new Sales station and its initial commission assignment commit atomically.
CREATE TABLE IF NOT EXISTS public.sales_station_creation_requests (
 actor_id uuid NOT NULL REFERENCES public.app_users(id),
 request_id uuid NOT NULL,
 station_id uuid NOT NULL REFERENCES public.stations(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.sales_station_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_station_creation_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.platform_sales_create_station(
 p_actor_id uuid,p_organization_name text,p_station_name text,
 p_brand_code text,p_enable_coupon boolean,p_enable_hr boolean,
 p_request_id uuid,p_max_stations integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_org uuid:=gen_random_uuid();v_station uuid:=gen_random_uuid();
 v_brand uuid;v_added integer;v_existing uuid;v_count integer;
 v_now timestamptz:=clock_timestamp();v_is_qa boolean;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='platform' AND m.role_code='platform_sales'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_request_id IS NULL OR p_organization_name IS NULL
  OR char_length(btrim(p_organization_name)) NOT BETWEEN 2 AND 160
  OR p_station_name IS NULL
  OR char_length(btrim(p_station_name)) NOT BETWEEN 2 AND 160
  OR p_brand_code IS NULL OR p_brand_code !~ '^[A-Z0-9_]{2,40}$'
  OR p_enable_coupon IS NULL OR p_enable_hr IS NULL
  OR (NOT p_enable_coupon AND NOT p_enable_hr)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;

 -- Serializes simultaneous submissions by one Sales user, including retries.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('sales_create:'||p_actor_id::text,0));
 SELECT r.station_id INTO v_existing
 FROM public.sales_station_creation_requests r
 WHERE r.actor_id=p_actor_id AND r.request_id=p_request_id;
 IF FOUND THEN
  RETURN (SELECT pg_catalog.jsonb_build_object(
    'id',s.id,'organizationId',s.organization_id,
    'stationName',s.name,'brandCode',b.code,
    'salesUserId',p_actor_id,'replayed',true,'fuelProductsStaged',
    (SELECT count(*) FROM public.station_fuel_products sf WHERE sf.station_id=s.id))
   FROM public.stations s JOIN public.fuel_brands b ON b.id=s.brand_id
   WHERE s.id=v_existing);
 END IF;
 -- Extra limit applies ONLY to trusted synthetic QA identities.
 -- A client can never supply/override p_max_stations: the Worker derives it.
 SELECT coalesce(u.raw_app_meta_data->>'oilstation_qa','false')='true'
 INTO v_is_qa FROM auth.users u WHERE u.id=p_actor_id;
 IF coalesce(v_is_qa,false) AND p_max_stations IS DISTINCT FROM 2
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 IF coalesce(v_is_qa,false) THEN
  SELECT count(*) INTO v_count FROM public.sales_station_creation_requests r
  WHERE r.actor_id=p_actor_id;
  IF v_count>=2 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SALES_STATION_LIMIT_REACHED';
  END IF;
 END IF;

 SELECT b.id INTO v_brand FROM public.fuel_brands b
 WHERE b.code=p_brand_code AND b.active;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BRAND'; END IF;

 INSERT INTO public.organizations(id,name) VALUES(v_org,btrim(p_organization_name));
 INSERT INTO public.stations(id,organization_id,brand_id,name)
 VALUES(v_station,v_org,v_brand,btrim(p_station_name));
 INSERT INTO public.station_modules(station_id,module_code,status)
 VALUES(v_station,'qr_coupon',CASE WHEN p_enable_coupon THEN 'enabled' ELSE 'disabled' END),
       (v_station,'hr_payroll',CASE WHEN p_enable_hr THEN 'enabled' ELSE 'disabled' END);
 INSERT INTO public.station_fuel_products(station_id,brand_product_id,enabled,current_public_price)
 SELECT v_station,p.id,false,NULL FROM public.brand_fuel_products p
 WHERE p.brand_id=v_brand AND p.active AND p.code<>'CUSTOM'
 AND p.verification_status<>'retired';
 GET DIAGNOSTICS v_added=ROW_COUNT;

 -- Immediate ownership: the initial commission window begins with station creation.
 INSERT INTO public.sales_assignments(station_id,sales_user_id,effective_from,assigned_by)
 VALUES(v_station,p_actor_id,v_now,p_actor_id);
 INSERT INTO public.sales_station_creation_requests(actor_id,request_id,station_id)
 VALUES(p_actor_id,p_request_id,v_station);
 INSERT INTO public.audit_events(actor_id,organization_id,station_id,
  entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,v_org,v_station,'station',v_station::text,
  'sales_station_created',
  pg_catalog.jsonb_build_object('brand_code',p_brand_code,
   'qr_coupon',p_enable_coupon,'hr_payroll',p_enable_hr,
   'originating_sales_user_id',p_actor_id,'effective_from',v_now,
   'request_id',p_request_id));
 RETURN pg_catalog.jsonb_build_object('id',v_station,'organizationId',v_org,
  'stationName',btrim(p_station_name),'brandCode',p_brand_code,
  'fuelProductsStaged',v_added,'salesUserId',p_actor_id,
  'commissionEffectiveFrom',v_now,'replayed',false);
END $fn$;
REVOKE ALL ON FUNCTION public.platform_sales_create_station(uuid,text,text,text,boolean,boolean,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_sales_create_station(uuid,text,text,text,boolean,boolean,uuid,integer)
 TO service_role;

CREATE OR REPLACE FUNCTION public.platform_sales_station_overview(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='platform'
   AND m.role_code='platform_sales') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 SELECT coalesce(jsonb_agg(pg_catalog.jsonb_build_object(
  'id',s.id,'stationName',s.name,'organizationId',o.id,
  'organizationName',o.name,'brandCode',b.code,'brandName',b.display_name_th,
  'modules',(SELECT coalesce(jsonb_object_agg(sm.module_code,sm.status),'{}'::jsonb)
    FROM public.station_modules sm WHERE sm.station_id=s.id)
 ) ORDER BY s.created_at DESC),'[]'::jsonb) INTO v_result
 FROM public.sales_assignments a
 JOIN public.stations s ON s.id=a.station_id
 JOIN public.organizations o ON o.id=s.organization_id
 LEFT JOIN public.fuel_brands b ON b.id=s.brand_id
 WHERE a.sales_user_id=p_actor_id AND a.effective_from<=clock_timestamp()
  AND (a.effective_until IS NULL OR a.effective_until>clock_timestamp());
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.platform_sales_station_overview(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_sales_station_overview(uuid) TO service_role;
