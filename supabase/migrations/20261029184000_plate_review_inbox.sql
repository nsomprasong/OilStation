-- Private, station-scoped supervisor queue. Viewing photo != verified plate.
CREATE OR REPLACE FUNCTION public.station_plate_review_inbox(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.active AND m.user_id=p_actor_id
   AND m.scope_type='station' AND m.station_id=p_station_id
   AND m.role_code IN ('station_owner','owner','manager','cashier'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'photoId',v.id,'couponId',v.coupon_id,
  'expectedPlate',v.plate_snapshot,'capturedAt',v.created_at)
  ORDER BY v.created_at DESC),'[]'::jsonb)
 INTO result FROM (
  SELECT pc.id,pc.coupon_id,c.plate_snapshot,pc.created_at
  FROM public.coupon_photo_checks pc
  JOIN public.coupons c ON c.id=pc.coupon_id AND c.station_id=pc.station_id
  WHERE pc.station_id=p_station_id AND pc.decision='pending'
   AND pc.captured_by<>p_actor_id AND c.status IN ('reserved','verified')
   AND c.expires_at>clock_timestamp()
  ORDER BY pc.created_at DESC LIMIT 25
 ) v;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.station_plate_photo_access(
 p_actor_id uuid,p_photo_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.coupon_photo_checks%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.coupon_photo_checks WHERE id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.active AND m.user_id=p_actor_id AND m.scope_type='station'
   AND m.station_id=p.station_id AND
   (m.role_code IN ('station_owner','owner','manager','cashier')
    OR (p.captured_by=p_actor_id AND
       (m.role_code IN ('attendant','pump_staff') OR
        m.extra_permissions->>'start_fueling'='true'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects so WHERE so.bucket_id='oilstation-evidence'
   AND so.name=p.photo_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN jsonb_build_object('path',p.photo_path);
END $fn$;
REVOKE ALL ON FUNCTION public.station_plate_review_inbox(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_plate_photo_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_plate_review_inbox(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_plate_photo_access(uuid,uuid) TO service_role;
