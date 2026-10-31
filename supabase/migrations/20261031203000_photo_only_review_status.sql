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


-- Signed-link QA coupon authorization for the publicly shared driver page.
-- The Worker validates the HMAC first; this helper verifies the coupon itself
-- belongs to the exact four fixture stations and twelve fixture companies.
CREATE OR REPLACE FUNCTION public.oilstation_qa_coupon_link_scope(
 p_coupon_id uuid,p_station_ids uuid[],p_company_ids uuid[]
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_i integer;v_si integer;v_slot integer;
BEGIN
 IF p_coupon_id IS NULL OR cardinality(p_station_ids) IS DISTINCT FROM 4
   OR cardinality(p_company_ids) IS DISTINCT FROM 12
   OR (SELECT count(DISTINCT x) FROM unnest(p_station_ids) x)<>4
   OR (SELECT count(DISTINCT x) FROM unnest(p_company_ids) x)<>12
 THEN RETURN false; END IF;
 FOR v_i IN 1..4 LOOP
  IF NOT EXISTS(SELECT 1 FROM public.stations s
    WHERE s.id=p_station_ids[v_i] AND s.name=v_names[v_i])
  THEN RETURN false; END IF;
 END LOOP;
 FOR v_i IN 1..12 LOOP
  v_si:=((v_i-1)/3)+1;v_slot:=((v_i-1)%3)+1;
  IF NOT EXISTS(SELECT 1 FROM public.corporate_station_accounts a
    JOIN public.corporate_companies c ON c.id=a.company_id
    WHERE c.id=p_company_ids[v_i] AND a.station_id=p_station_ids[v_si]
      AND c.name=v_names[v_si]||'-C0'||v_slot::text)
  THEN RETURN false; END IF;
 END LOOP;
 RETURN EXISTS(
   SELECT 1 FROM public.coupons c
   JOIN public.corporate_station_accounts a ON a.id=c.account_id
   WHERE c.id=p_coupon_id AND a.station_id=c.station_id
     AND c.station_id=ANY(p_station_ids)
     AND a.company_id=ANY(p_company_ids)
 );
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_coupon_link_scope(uuid,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_coupon_link_scope(uuid,uuid[],uuid[])
 TO service_role;
