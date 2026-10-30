-- Station-scoped, private fuel meter and receipt intake.
-- Uploads remain pending; no balance, settlement, or paid status is changed.
CREATE TABLE IF NOT EXISTS public.fuel_evidence_intake(
 evidence_id uuid PRIMARY KEY REFERENCES public.fuel_evidence(id),
 captured_by uuid NOT NULL REFERENCES public.app_users(id),
 review_status text NOT NULL DEFAULT 'pending'
   CHECK(review_status IN ('pending','approved','rejected')),
 reviewed_by uuid REFERENCES public.app_users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT fuel_intake_review_state CHECK(
   (review_status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
   OR (review_status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
ALTER TABLE public.fuel_evidence_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_evidence_intake FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.fuel_evidence_intake FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS fuel_evidence_session_kind_idx
 ON public.fuel_evidence(session_id,kind,created_at DESC);
CREATE OR REPLACE FUNCTION public.authorize_fuel_photo_upload(
 p_actor_id uuid,p_session_id uuid,p_kind text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE s public.fuel_sessions%ROWTYPE;
BEGIN
 IF p_kind NOT IN ('pump_display','receipt')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 SELECT * INTO s FROM public.fuel_sessions WHERE id=p_session_id;
 IF NOT FOUND OR s.status<>'fueling'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND
  m.scope_type='station' AND m.station_id=s.station_id
  AND (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
      OR m.extra_permissions->>'finish_fueling'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN jsonb_build_object('stationId',s.station_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.record_fuel_photo_upload(
 p_actor_id uuid,p_session_id uuid,p_kind text,p_photo_path text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE s public.fuel_sessions%ROWTYPE;v_id uuid;
BEGIN
 SELECT * INTO s FROM public.fuel_sessions WHERE id=p_session_id FOR UPDATE;
 PERFORM public.authorize_fuel_photo_upload(p_actor_id,p_session_id,p_kind);
 IF p_photo_path IS NULL OR p_photo_path !~ (
    '^stations/'||s.station_id::text||'/sessions/'||p_session_id::text||
    '/'||p_kind||'/[0-9a-f-]{36}\.(jpg|png)$')
    OR NOT EXISTS(SELECT 1 FROM storage.objects o
      WHERE o.bucket_id='oilstation-evidence' AND o.name=p_photo_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.fuel_evidence(session_id,kind,storage_path,ocr_result)
 VALUES(p_session_id,p_kind,p_photo_path,'{"status":"pending_ocr"}'::jsonb)
 RETURNING id INTO v_id;
 INSERT INTO public.fuel_evidence_intake(evidence_id,captured_by)
 VALUES(v_id,p_actor_id);
 RETURN jsonb_build_object('evidenceId',v_id,'status','pending_ocr',
    'verified',false);
END $fn$;
REVOKE ALL ON FUNCTION public.authorize_fuel_photo_upload(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_fuel_photo_upload(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_fuel_photo_upload(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_fuel_photo_upload(uuid,uuid,text,text) TO service_role;
