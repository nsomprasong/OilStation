-- Worker-only helper for station-scoped plate photo intake.
-- Neither function marks the photo verified; trusted OCR/review must do that.
CREATE OR REPLACE FUNCTION public.authorize_station_plate_upload(
 p_actor_id uuid,p_station_id uuid,p_coupon_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE c public.coupons%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.coupons WHERE id=p_coupon_id;
 IF NOT FOUND OR c.station_id<>p_station_id
  OR c.status NOT IN ('reserved','verified')
  OR c.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_NOT_AVAILABLE';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND
   ((m.scope_type='station' AND m.station_id=p_station_id
     AND (m.role_code IN ('station_owner','owner','manager','attendant','pump_staff')
       OR m.extra_permissions->>'start_fueling'='true'))
    OR (m.scope_type='organization' AND m.organization_id=
      (SELECT organization_id FROM public.stations WHERE id=p_station_id)
      AND m.role_code IN ('organization_owner','owner')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN jsonb_build_object('authorized',true,'stationId',p_station_id,'couponId',p_coupon_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_station_plate_photo(
 p_actor_id uuid,p_station_id uuid,p_coupon_id uuid,p_photo_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid;
BEGIN
 PERFORM public.authorize_station_plate_upload(p_actor_id,p_station_id,p_coupon_id);
 IF p_photo_path IS NULL
   OR p_photo_path !~ ('^stations/'||p_station_id::text||'/plate/'||
        p_coupon_id::text||'/[0-9a-f-]{36}\.(jpg|png)$')
   OR NOT EXISTS(
     SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-evidence'
      AND o.name=p_photo_path
   ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE';END IF;
 INSERT INTO public.coupon_photo_checks(coupon_id,station_id,photo_path,captured_by,decision)
 VALUES(p_coupon_id,p_station_id,p_photo_path,p_actor_id,'pending')
 ON CONFLICT(coupon_id,photo_path) DO UPDATE SET photo_path=excluded.photo_path
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('photoId',v_id,'status','pending_ocr',
   'verified',false);
END $fn$;
REVOKE ALL ON FUNCTION public.authorize_station_plate_upload(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_station_plate_photo(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_station_plate_upload(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_station_plate_photo(uuid,uuid,uuid,text) TO service_role;
