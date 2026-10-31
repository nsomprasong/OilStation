-- Photo-only registration checking. No OCR lookup is needed.
-- Expose status only to a same-station member who can upload/check evidence.
CREATE OR REPLACE FUNCTION public.oilstation_plate_photo_status(
 p_actor_id uuid,p_photo_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.coupon_photo_checks%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.coupon_photo_checks WHERE id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.memberships m
   WHERE m.active AND m.user_id=p_actor_id
     AND m.scope_type='station' AND m.station_id=p.station_id
     AND (m.role_code IN ('station_owner','owner','manager','cashier',
                         'attendant','pump_staff')
          OR m.extra_permissions->>'start_fueling'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(
   SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-evidence'
     AND o.name=p.photo_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN pg_catalog.jsonb_build_object(
   'photoId',p.id,'status',p.decision,
   'verified',p.decision='verified_supervisor',
   'checkedAt',p.checked_at
 );
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_plate_photo_status(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_plate_photo_status(uuid,uuid) TO service_role;
