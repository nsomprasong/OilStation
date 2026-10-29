-- Start fueling only after trusted OCR/supervisor attestation.
-- Installed only in isolated staging after security/rollback review.
CREATE OR REPLACE FUNCTION public.begin_verified_fuel_session(
 p_actor_id uuid,p_photo_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_coupon_id uuid;c public.coupons%ROWTYPE;
 p public.coupon_photo_checks%ROWTYPE;s public.fuel_sessions%ROWTYPE;
 v_result jsonb;
BEGIN
 SELECT coupon_id INTO v_coupon_id FROM public.coupon_photo_checks WHERE id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO c FROM public.coupons WHERE id=v_coupon_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO p FROM public.coupon_photo_checks
  WHERE id=p_photo_id AND coupon_id=c.id AND station_id=c.station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='station' AND m.station_id=c.station_id
      AND (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
       OR m.extra_permissions->>'start_fueling'='true'))
    OR (m.scope_type='organization' AND m.organization_id=
       (SELECT organization_id FROM public.stations WHERE id=c.station_id)
       AND m.role_code IN ('organization_owner','owner'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p.decision NOT IN ('verified_ocr','verified_supervisor')
  OR p.checked_at IS NULL OR p.observed_plate IS NULL
  OR NOT EXISTS(SELECT 1 FROM storage.objects o
      WHERE o.bucket_id='oilstation-evidence' AND o.name=p.photo_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF c.status='fueling' THEN
   SELECT fs.* INTO s FROM public.fuel_sessions fs JOIN public.fuel_evidence fe
     ON fe.session_id=fs.id AND fe.kind='plate' AND fe.storage_path=p.photo_path
     WHERE fs.coupon_id=c.id AND fs.status='fueling' LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
   RETURN jsonb_build_object('id',s.id,'status','fueling','replayed',true,
     'started_at',s.started_at,'public_price',s.locked_public_price,
     'corporate_price',s.locked_net_price);
 END IF;
 IF c.status<>'reserved' OR c.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- The existing start RPC ALSO validates the trusted photo against the coupon.
 -- It fails closed on legacy non-standard plate formats until reviewed separately.
 v_result:=public.start_reserved_fuel_session(p_actor_id,c.id,
   coalesce(c.plate_snapshot,p.observed_plate),p.photo_path);
 RETURN v_result||jsonb_build_object('replayed',false);
END $fn$;
REVOKE ALL ON FUNCTION public.begin_verified_fuel_session(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_verified_fuel_session(uuid,uuid) TO service_role;
