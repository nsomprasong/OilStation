-- Record requested and approved OT minutes. This does not calculate pay:
-- Thailand statutory OT multipliers must be reviewed by payroll compliance.
CREATE UNIQUE INDEX IF NOT EXISTS overtime_one_pending_per_shift
 ON public.overtime_requests(employee_id,shift_assignment_id,planned)
 WHERE status='pending' AND shift_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hr_request_overtime(
 p_actor_id uuid,p_employee_id uuid,p_shift_id uuid,p_planned boolean,
 p_requested_minutes integer,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 e public.employees%ROWTYPE;
 v_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND employment_status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=e.station_id AND sm.module_code='hr_payroll' AND sm.status='enabled') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
   SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=e.station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_shift_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.shift_assignments a
    WHERE a.id=p_shift_id AND a.employee_id=e.id
      AND a.status IN ('scheduled','replaced','absence_review')
 ) OR p_planned IS NULL OR p_requested_minutes IS NULL
   OR p_requested_minutes<1 OR p_requested_minutes>960
   OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 4 AND 500 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 INSERT INTO public.overtime_requests(id,employee_id,shift_assignment_id,planned,
   requested_minutes,reason,status)
 VALUES(v_id,e.id,p_shift_id,p_planned,p_requested_minutes,btrim(p_reason),'pending');
 RETURN jsonb_build_object('requestId',v_id,'status','pending',
   'requestedMinutes',p_requested_minutes,'planned',p_planned);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_approve_overtime(
 p_actor_id uuid,p_request_id uuid,p_approved_minutes integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 r public.overtime_requests%ROWTYPE;
 e public.employees%ROWTYPE;
 v_status text;
BEGIN
 SELECT * INTO r FROM public.overtime_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO e FROM public.employees WHERE id=r.employee_id;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND (
    (m.scope_type='station' AND m.station_id=e.station_id
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='platform' AND m.role_code='platform_superadmin')
   )
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_actor_id=e.user_id THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';
 END IF;
 IF r.status<>'pending' THEN
  RETURN jsonb_build_object('requestId',r.id,'status',r.status,'replayed',true);
 END IF;
 IF p_approved_minutes IS NULL OR p_approved_minutes<0
   OR p_approved_minutes>r.requested_minutes THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 v_status:=case when p_approved_minutes=0 then 'rejected'
    when p_approved_minutes=r.requested_minutes then 'approved' else 'partial' end;
 UPDATE public.overtime_requests SET approved_minutes=p_approved_minutes,
   status=v_status,approved_by=p_actor_id,approved_at=clock_timestamp()
 WHERE id=r.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,
  after_state) VALUES(p_actor_id,e.station_id,'overtime_request',r.id::text,'overtime_reviewed',
  jsonb_build_object('approved_minutes',p_approved_minutes,'status',v_status));
 RETURN jsonb_build_object('requestId',r.id,'status',v_status,
   'approvedMinutes',p_approved_minutes,'replayed',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_pending_overtime(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND (
    (m.scope_type='station' AND m.station_id=p_station_id
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='platform' AND m.role_code='platform_superadmin')
  )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'employeeId',r.employee_id,'employeeName',e.display_name,
   'shiftDate',s.shift_date,'planned',r.planned,
   'requestedMinutes',r.requested_minutes,'reason',r.reason
 ) ORDER BY r.created_at),'[]'::jsonb)
 INTO result FROM public.overtime_requests r
 JOIN public.employees e ON e.id=r.employee_id
 JOIN public.shift_assignments s ON s.id=r.shift_assignment_id
 WHERE e.station_id=p_station_id AND r.status='pending';
 RETURN result;
END $fn$;

REVOKE ALL ON FUNCTION public.hr_request_overtime(uuid,uuid,uuid,boolean,integer,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_approve_overtime(uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_pending_overtime(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_request_overtime(uuid,uuid,uuid,boolean,integer,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_approve_overtime(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_pending_overtime(uuid,uuid) TO service_role;
