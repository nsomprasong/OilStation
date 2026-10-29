-- Human review fallback for GPS attendance; does NOT attest face recognition.
-- This is a supervisor decision with immutable audit, not an automatic payroll run.
CREATE TABLE IF NOT EXISTS public.attendance_review_audit(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 attendance_event_id uuid NOT NULL REFERENCES public.attendance_events(id),
 reviewer_id uuid NOT NULL REFERENCES public.app_users(id),
 decision text NOT NULL CHECK(decision IN ('accepted','rejected')),
 method text NOT NULL DEFAULT 'supervisor_manual'
   CHECK(method='supervisor_manual'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 10 AND 1000),
 reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(attendance_event_id)
);
ALTER TABLE public.attendance_review_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_review_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_review_audit FROM PUBLIC,anon,authenticated,service_role;
-- Single-use review decisions are an append-only audit journal. Even a
-- privileged service-role routine must not rewrite or remove history.
CREATE OR REPLACE FUNCTION public.reject_attendance_audit_rewrite()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REVIEW_AUDIT_IMMUTABLE';
END $fn$;
DROP TRIGGER IF EXISTS reject_attendance_audit_rewrite
 ON public.attendance_review_audit;
CREATE TRIGGER reject_attendance_audit_rewrite
 BEFORE UPDATE OR DELETE ON public.attendance_review_audit
 FOR EACH ROW EXECUTE FUNCTION public.reject_attendance_audit_rewrite();
CREATE INDEX IF NOT EXISTS attendance_events_staff_pending_idx
 ON public.attendance_events(employee_id,recorded_at DESC)
 WHERE review_status='pending';

CREATE OR REPLACE FUNCTION public.hr_attendance_pending_inbox(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=p_station_id AND
   m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'eventId',v.id,'employeeName',v.display_name,'eventType',v.event_type,
  'occurredAt',v.occurred_at,'geofenceStatus',v.geofence_status,
  'accuracyMeters',v.accuracy_meters)
 ORDER BY v.occurred_at DESC),'[]'::jsonb) INTO result
 FROM(
  SELECT a.id,e.display_name,a.event_type,a.occurred_at,
    a.geofence_status,a.accuracy_meters
  FROM public.attendance_events a
   JOIN public.employees e ON e.id=a.employee_id
  WHERE e.station_id=p_station_id AND a.review_status='pending'
    AND (e.user_id IS NULL OR e.user_id<>p_actor_id)
  ORDER BY a.occurred_at DESC LIMIT 60
 ) v;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_review_attendance_manual(
 p_actor_id uuid,p_event_id uuid,p_approved boolean,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a public.attendance_events%ROWTYPE;
 e public.employees%ROWTYPE;
BEGIN
 IF p_approved IS NULL OR p_reason IS NULL
  OR char_length(btrim(p_reason)) NOT BETWEEN 10 AND 1000
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO a FROM public.attendance_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO e FROM public.employees WHERE id=a.employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF e.user_id=p_actor_id OR NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=e.station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF a.review_status<>'pending' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 UPDATE public.attendance_events SET
  review_status=CASE WHEN p_approved THEN 'accepted' ELSE 'rejected' END
 WHERE id=a.id;
 INSERT INTO public.attendance_review_audit(
  attendance_event_id,reviewer_id,decision,reason
 ) VALUES(a.id,p_actor_id,CASE WHEN p_approved THEN 'accepted' ELSE 'rejected' END,
  btrim(p_reason));
 RETURN jsonb_build_object('eventId',a.id,'status',
  CASE WHEN p_approved THEN 'accepted' ELSE 'rejected' END,
  'faceVerified',false,'method','supervisor_manual');
END $fn$;
REVOKE ALL ON FUNCTION public.hr_attendance_pending_inbox(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_review_attendance_manual(uuid,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_attendance_pending_inbox(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_review_attendance_manual(uuid,uuid,boolean,text)
 TO service_role;
