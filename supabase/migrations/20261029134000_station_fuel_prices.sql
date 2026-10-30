-- Station fuel administration. Prices are owned by each station,
-- independent from global brand templates and other tenants.
CREATE OR REPLACE FUNCTION public.station_fuel_inventory(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
END $fn$;

CREATE OR REPLACE FUNCTION public.configure_station_fuel(
 p_actor_id uuid,p_station_id uuid,p_station_fuel_id uuid,
 p_enabled boolean,p_public_price numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
END $fn$;

REVOKE ALL ON FUNCTION public.station_fuel_inventory(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.configure_station_fuel(uuid,uuid,uuid,boolean,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_fuel_inventory(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.configure_station_fuel(uuid,uuid,uuid,boolean,numeric) TO service_role;
