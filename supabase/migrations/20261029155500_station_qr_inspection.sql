-- Read-only QR inspection; checks a live QR version and the authenticated
-- station employee's station assignment. This does not accept a coupon ID
-- supplied by a client as proof of possession.
CREATE OR REPLACE FUNCTION public.inspect_station_coupon(
 p_actor_id uuid,p_qr_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
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
$fn$;
REVOKE ALL ON FUNCTION public.inspect_station_coupon(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_station_coupon(uuid,text) TO service_role;
