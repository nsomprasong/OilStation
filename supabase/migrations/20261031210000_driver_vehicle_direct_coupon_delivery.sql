-- Driver-specific delivery of fuel coupons. No LINE messaging and no OCR.
-- Company admins assign a verified company driver to the vehicle actually used.
ALTER TABLE public.corporate_drivers
 ADD COLUMN IF NOT EXISTS current_vehicle_id uuid REFERENCES public.corporate_vehicles(id);

CREATE UNIQUE INDEX IF NOT EXISTS oilstation_company_driver_identity_uniq
 ON public.corporate_drivers(company_id,user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_driver_coupon_inbox_idx
 ON public.coupons(driver_id,issued_at DESC) WHERE driver_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.oilstation_company_driver_roster(
 p_actor_id uuid,p_company_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_rows jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
   AND m.user_id=p_actor_id AND m.scope_type='corporate_company'
   AND m.corporate_company_id=p_company_id
   AND (m.role_code IN ('corporate_admin','coupon_issuer','qr_issuer')
     OR m.extra_permissions->>'issue_coupon'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'userId',t.user_id,'driverId',t.driver_id,
    'displayName',t.display_name,'vehicleId',t.vehicle_id,
    'plate',t.plate,'province',t.province)
    ORDER BY t.display_name,t.user_id),'[]'::jsonb)
 INTO v_rows FROM (
 SELECT m.user_id,cd.id AS driver_id,
   coalesce(nullif(au.display_name,''),au.email,'คนขับบริษัท') AS display_name,
   v.id AS vehicle_id,v.plate_number AS plate,v.province
 FROM public.memberships m
 JOIN public.app_users au ON au.id=m.user_id
 LEFT JOIN public.corporate_drivers cd ON cd.user_id=m.user_id
   AND cd.company_id=m.corporate_company_id AND cd.active
 LEFT JOIN public.corporate_vehicles v ON v.id=cd.current_vehicle_id
   AND v.company_id=m.corporate_company_id AND v.active
 WHERE m.active AND m.scope_type='corporate_company'
   AND m.role_code='driver' AND m.corporate_company_id=p_company_id
 ) t;
 RETURN v_rows;
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_assign_driver_vehicle(
 p_actor_id uuid,p_company_id uuid,p_driver_user_id uuid,p_plate text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_plate text;v_vehicle public.corporate_vehicles%ROWTYPE;
 v_driver public.corporate_drivers%ROWTYPE;v_name text;
BEGIN
 v_plate:=btrim(coalesce(p_plate,''));
 IF p_actor_id IS NULL OR p_company_id IS NULL OR p_driver_user_id IS NULL
 OR char_length(v_plate) NOT BETWEEN 4 AND 20
 OR v_plate !~ '^[ก-๙A-Za-z0-9 -]+$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.active AND m.user_id=p_actor_id AND m.scope_type='corporate_company'
     AND m.corporate_company_id=p_company_id AND m.role_code='corporate_admin')
 OR NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.active AND m.user_id=p_driver_user_id AND m.scope_type='corporate_company'
     AND m.corporate_company_id=p_company_id AND m.role_code='driver')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 -- Serialize driver/plate assignment by company to prevent duplicate identities
 -- and simultaneous allocation of the same car to two active drivers.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('company-vehicle:'||p_company_id::text,0));
 SELECT * INTO v_vehicle FROM public.corporate_vehicles
 WHERE company_id=p_company_id AND plate_number=v_plate AND active
 ORDER BY id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO public.corporate_vehicles(company_id,plate_number,description,active)
   VALUES(p_company_id,v_plate,'รถบริษัท',true) RETURNING * INTO v_vehicle;
 END IF;
 SELECT * INTO v_driver FROM public.corporate_drivers
 WHERE company_id=p_company_id AND user_id=p_driver_user_id FOR UPDATE;
 IF FOUND THEN
   IF EXISTS(SELECT 1 FROM public.coupons c WHERE c.driver_id=v_driver.id
    AND c.status IN ('reserved','verified','fueling')
    AND c.expires_at>clock_timestamp()
    AND c.vehicle_id IS DISTINCT FROM v_vehicle.id)
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ACTIVE_COUPON_REQUIRES_CANCELLATION';END IF;
 ELSE
   SELECT coalesce(nullif(display_name,''),email,'คนขับบริษัท')
   INTO v_name FROM public.app_users WHERE id=p_driver_user_id;
   INSERT INTO public.corporate_drivers(company_id,user_id,display_name,active)
   VALUES(p_company_id,p_driver_user_id,coalesce(v_name,'คนขับบริษัท'),true)
   RETURNING * INTO v_driver;
 END IF;
 IF EXISTS(SELECT 1 FROM public.corporate_drivers cd
   WHERE cd.company_id=p_company_id AND cd.id<>v_driver.id
     AND cd.active AND cd.current_vehicle_id=v_vehicle.id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='VEHICLE_ALREADY_ASSIGNED';END IF;
 UPDATE public.corporate_drivers SET current_vehicle_id=v_vehicle.id,active=true
 WHERE id=v_driver.id;
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'corporate_driver',v_driver.id::text,'driver_vehicle_assigned',
  jsonb_build_object('companyId',p_company_id,'vehicleId',v_vehicle.id));
 RETURN jsonb_build_object('driverId',v_driver.id,'vehicleId',v_vehicle.id,
   'plate',v_vehicle.plate_number);
END $fn$;

-- Atomic wrapper: reserve wallet using the existing proven finance RPC, then
-- attach the fixed driver and vehicle to THAT reservation in the same tx.
CREATE OR REPLACE FUNCTION public.oilstation_issue_driver_coupon(
 p_coupon_id uuid,p_actor_id uuid,p_account_id uuid,p_station_fuel_id uuid,
 p_amount_satang bigint,p_expires_at timestamptz,p_driver_id uuid,
 p_secret_hash text,p_qr_hash text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_company uuid;v_driver public.corporate_drivers%ROWTYPE;
 v_vehicle public.corporate_vehicles%ROWTYPE;v_existing public.coupons%ROWTYPE;
 v_result jsonb;v_coupon_id uuid;
BEGIN
 SELECT company_id INTO v_company FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR p_driver_id IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_driver FROM public.corporate_drivers
  WHERE id=p_driver_id AND company_id=v_company AND active FOR UPDATE;
 IF NOT FOUND OR v_driver.user_id IS NULL OR
   NOT EXISTS(SELECT 1 FROM public.memberships m
     WHERE m.active AND m.scope_type='corporate_company'
       AND m.role_code='driver' AND m.user_id=v_driver.user_id
       AND m.corporate_company_id=v_company)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO v_vehicle FROM public.corporate_vehicles
 WHERE id=v_driver.current_vehicle_id AND company_id=v_company AND active;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_VEHICLE';END IF;
 v_result:=public.issue_reserved_coupon(
    p_coupon_id,p_actor_id,p_account_id,p_station_fuel_id,p_amount_satang,
    p_expires_at,v_vehicle.plate_number,p_secret_hash,p_qr_hash,p_idempotency_key);
 v_coupon_id:=(v_result->>'id')::uuid;
 SELECT * INTO v_existing FROM public.coupons WHERE id=v_coupon_id FOR UPDATE;
 IF NOT FOUND OR v_existing.account_id<>p_account_id
   OR (v_result->>'replayed')::boolean AND
      (v_existing.driver_id IS DISTINCT FROM v_driver.id
       OR v_existing.vehicle_id IS DISTINCT FROM v_vehicle.id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
 IF v_result->>'replayed'='false' THEN
   UPDATE public.coupons SET driver_id=v_driver.id,vehicle_id=v_vehicle.id
   WHERE id=v_coupon_id AND driver_id IS NULL AND vehicle_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 END IF;
 RETURN v_result;
END $fn$;

-- Driver's app ONLY: it never receives other employees' coupons or private
-- company accounting. The Worker computes a QR HMAC only for returned IDs.
CREATE OR REPLACE FUNCTION public.oilstation_driver_coupon_inbox(
 p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_data jsonb;v_vehicles jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
   AND m.user_id=p_actor_id AND m.scope_type='corporate_company'
   AND m.role_code='driver')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,'status',t.status,'expiresAt',t.expires_at,
  'plate',t.plate_snapshot,'stationName',t.station_name,
  'fuelName',t.fuel_name,'maxAmountSatang',t.max_amount_satang::text,
  'driverName',t.driver_name,'currentPlate',t.current_plate)
  ORDER BY t.issued_at DESC),'[]'::jsonb)
 INTO v_data FROM (
 SELECT c.id,c.status,c.expires_at,c.plate_snapshot,c.max_amount_satang,
   c.issued_at,s.name AS station_name,
   coalesce(fp.name_override,fp.custom_name,bfp.name_th,'น้ำมัน') AS fuel_name,
   cd.display_name AS driver_name,cv.plate_number AS current_plate
 FROM public.coupons c
 JOIN public.corporate_drivers cd ON cd.id=c.driver_id
 JOIN public.corporate_station_accounts ca ON ca.id=c.account_id
 JOIN public.stations s ON s.id=c.station_id
 JOIN public.station_fuel_products fp ON fp.id=c.station_fuel_id
 LEFT JOIN public.brand_fuel_products bfp ON bfp.id=fp.brand_product_id
 LEFT JOIN public.corporate_vehicles cv ON cv.id=cd.current_vehicle_id
 WHERE cd.user_id=p_actor_id AND cd.active AND ca.company_id=cd.company_id
  AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
   AND m.user_id=p_actor_id AND m.scope_type='corporate_company'
   AND m.role_code='driver' AND m.corporate_company_id=cd.company_id)
 ORDER BY c.issued_at DESC LIMIT 30
 ) t;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
     'driverName',cd.display_name,'plate',v.plate_number,
     'province',v.province,'companyId',cd.company_id)
     ORDER BY cd.display_name),'[]'::jsonb)
 INTO v_vehicles
 FROM public.corporate_drivers cd
 JOIN public.memberships m ON m.user_id=cd.user_id AND m.corporate_company_id=cd.company_id
 JOIN public.corporate_vehicles v ON v.id=cd.current_vehicle_id
 WHERE cd.user_id=p_actor_id AND cd.active AND v.active AND m.active
   AND m.scope_type='corporate_company' AND m.role_code='driver';
 RETURN jsonb_build_object('vehicles',v_vehicles,'coupons',v_data);
END $fn$;

REVOKE ALL ON FUNCTION public.oilstation_company_driver_roster(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_assign_driver_vehicle(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_issue_driver_coupon(uuid,uuid,uuid,uuid,bigint,timestamptz,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_driver_coupon_inbox(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_company_driver_roster(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_assign_driver_vehicle(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_issue_driver_coupon(uuid,uuid,uuid,uuid,bigint,timestamptz,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_driver_coupon_inbox(uuid) TO service_role;
