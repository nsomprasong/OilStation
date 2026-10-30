-- Read-only payroll *review* gate: independently audited supervisor punches
-- only. GPS proximity by itself is not proof of worked time or face identity.
-- The response is never a payroll approval, payslip or transfer instruction.
CREATE OR REPLACE FUNCTION public.hr_reviewed_attendance_punches(
 p_actor_id uuid,p_employee_id uuid,p_from timestamptz,p_until timestamptz
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_employee public.employees%ROWTYPE;
 v_total bigint;v_approved bigint;v_events jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_employee_id IS NULL OR p_from IS NULL
   OR p_until IS NULL OR p_until<=p_from
   OR p_until>p_from+interval '35 days'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_employee FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=v_employee.station_id
   AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT count(*),
   count(*) FILTER(WHERE a.review_status='accepted'
     AND audit.decision='accepted' AND audit.method='supervisor_manual')
 INTO v_total,v_approved
 FROM public.attendance_events a
 LEFT JOIN public.attendance_review_audit audit
   ON audit.attendance_event_id=a.id
 WHERE a.employee_id=p_employee_id
  AND a.occurred_at>=p_from AND a.occurred_at<p_until;
 -- Include legacy "accepted by default" records in v_total, but NEVER
 -- pass them through unless independent manual approval actually exists.
 IF v_total=0 OR v_total>2000 OR v_total<>v_approved
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PUNCH_REVIEW_REQUIRED';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'eventType',a.event_type,'occurredAt',a.occurred_at,
   'reviewStatus',a.review_status) ORDER BY a.occurred_at,a.id),'[]'::jsonb)
 INTO v_events
 FROM public.attendance_events a
 JOIN public.attendance_review_audit audit
   ON audit.attendance_event_id=a.id AND audit.decision='accepted'
   AND audit.method='supervisor_manual'
 WHERE a.employee_id=p_employee_id AND a.review_status='accepted'
  AND a.occurred_at>=p_from AND a.occurred_at<p_until;
 RETURN jsonb_build_object('employeeId',p_employee_id,'stationId',
   v_employee.station_id,'status','preview_only','payable',false,
   'faceVerified',false,'events',v_events);
END $fn$;
REVOKE ALL ON FUNCTION public.hr_reviewed_attendance_punches(
 uuid,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_reviewed_attendance_punches(
 uuid,uuid,timestamptz,timestamptz) TO service_role;


-- Station-local business days: e.g. 00:30 Bangkok is in the previous UTC day.
CREATE OR REPLACE FUNCTION public.hr_reviewed_attendance_punches_local(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_timezone text;
BEGIN
 IF p_start_date IS NULL OR p_end_date IS NULL OR
    p_end_date<=p_start_date OR p_end_date>p_start_date+35
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT st.timezone INTO v_timezone
 FROM public.employees e JOIN public.stations st ON st.id=e.station_id
 WHERE e.id=p_employee_id;
 IF NOT FOUND OR v_timezone IS NULL OR v_timezone=''
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN public.hr_reviewed_attendance_punches(p_actor_id,p_employee_id,
   p_start_date::timestamp AT TIME ZONE v_timezone,
   p_end_date::timestamp AT TIME ZONE v_timezone);
END $fn$;
REVOKE ALL ON FUNCTION public.hr_reviewed_attendance_punches_local(
 uuid,uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_reviewed_attendance_punches_local(
 uuid,uuid,date,date) TO service_role;
