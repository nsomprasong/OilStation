-- Request/independent review only. Never calculates leave entitlement or alters payroll.
ALTER TABLE public.leave_requests
 ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.app_users(id),
 ADD COLUMN IF NOT EXISTS reason text,
 ADD COLUMN IF NOT EXISTS reviewed_decision_note text;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.leave_requests TO service_role;
CREATE INDEX IF NOT EXISTS hr_leave_employee_period_idx
 ON public.leave_requests(employee_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS hr_leave_pending_idx
 ON public.leave_requests(employee_id,created_at) WHERE status='pending';

CREATE OR REPLACE FUNCTION public.hr_request_leave_safe(
 p_actor_id uuid,p_employee_id uuid,p_leave_type text,p_start_date date,
 p_end_date date,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE e public.employees%ROWTYPE;v_id uuid:=pg_catalog.gen_random_uuid();v_reason text;
BEGIN
 IF p_start_date IS NULL OR p_end_date IS NULL
   OR p_start_date<current_date OR p_start_date>current_date+366
   OR p_end_date<p_start_date OR p_end_date-p_start_date>30
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_LEAVE_DATES'; END IF;
 IF p_leave_type NOT IN ('annual','sick','personal','unpaid') OR p_leave_type IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_LEAVE_TYPE';END IF;
 IF p_reason IS NOT NULL AND char_length(p_reason)>500
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_LEAVE_REASON';END IF;
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND OR e.employment_status<>'active'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMPLOYEE_NOT_ELIGIBLE';END IF;
 IF p_actor_id IS DISTINCT FROM e.user_id AND NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='station' AND m.station_id=e.station_id
   AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 -- One serializable logical lock per employee closes overlapping-request races.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_employee_id::text,1));
 IF EXISTS(SELECT 1 FROM public.leave_requests l WHERE l.employee_id=p_employee_id
  AND l.status IN ('pending','approved')
  AND l.start_date<=p_end_date AND l.end_date>=p_start_date)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='OVERLAPPING_LEAVE';END IF;
 v_reason:=nullif(btrim(p_reason),'');
 INSERT INTO public.leave_requests(id,employee_id,leave_type,start_date,end_date,
  status,requested_by,reason)
 VALUES(v_id,p_employee_id,p_leave_type,p_start_date,p_end_date,
  'pending',p_actor_id,v_reason);
 INSERT INTO public.audit_events(id,actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(pg_catalog.gen_random_uuid(),p_actor_id,e.station_id,'leave_request',v_id::text,
  'leave_requested',pg_catalog.jsonb_build_object('employeeId',p_employee_id,'type',
   p_leave_type,'startDate',p_start_date,'endDate',p_end_date,'status','pending',
   'payrollImpact','undetermined'));
 RETURN pg_catalog.jsonb_build_object('id',v_id,'status','pending','leaveType',p_leave_type,
  'startDate',p_start_date,'endDate',p_end_date,'requestedBy',p_actor_id,
  'payrollImpact','undetermined','payable',false,'deducted',false);
END $func$;

CREATE OR REPLACE FUNCTION public.hr_list_leave_safe(
 p_actor_id uuid,p_employee_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE e public.employees%ROWTYPE;v_data jsonb;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF p_actor_id IS DISTINCT FROM e.user_id AND NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='station' AND m.station_id=e.station_id
   AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',l.id,'employeeId',l.employee_id,'leaveType',l.leave_type,
  'startDate',l.start_date,'endDate',l.end_date,
  'reason',l.reason,'status',l.status,'requestedBySelf',l.requested_by=p_actor_id,
  'reviewedAt',l.reviewed_at,'payrollImpact','undetermined',
  'deducted',false,'payable',false
 ) ORDER BY l.created_at DESC),'[]'::jsonb) INTO v_data
 FROM public.leave_requests l WHERE l.employee_id=p_employee_id;
 RETURN v_data;
END $func$;

CREATE OR REPLACE FUNCTION public.hr_review_leave_safe(
 p_actor_id uuid,p_request_id uuid,p_approved boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $func$
DECLARE l public.leave_requests%ROWTYPE;e public.employees%ROWTYPE;v_status text;
BEGIN
 SELECT * INTO l FROM public.leave_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO e FROM public.employees WHERE id=l.employee_id;
 IF p_actor_id IS NOT DISTINCT FROM l.requested_by OR p_actor_id IS NOT DISTINCT FROM e.user_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=e.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF l.status<>'pending' THEN RETURN pg_catalog.jsonb_build_object(
  'id',l.id,'status',l.status,'replayed',true,'payrollImpact','undetermined',
  'deducted',false);END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REVIEW';END IF;
 v_status:=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
 UPDATE public.leave_requests SET status=v_status,reviewed_by=p_actor_id,
  reviewed_at=pg_catalog.clock_timestamp() WHERE id=l.id;
 INSERT INTO public.audit_events(id,actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(pg_catalog.gen_random_uuid(),p_actor_id,e.station_id,'leave_request',l.id::text,
  'leave_reviewed',pg_catalog.jsonb_build_object('status',v_status,
   'payrollImpact','undetermined','noPayrollDeduction',true));
 RETURN pg_catalog.jsonb_build_object('id',l.id,'status',v_status,'replayed',false,
  'payrollImpact','undetermined','payable',false,'deducted',false,
  'attendanceAutoChanged',false);
END $func$;

REVOKE ALL ON FUNCTION public.hr_request_leave_safe(uuid,uuid,text,date,date,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_list_leave_safe(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_review_leave_safe(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_request_leave_safe(uuid,uuid,text,date,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_list_leave_safe(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_review_leave_safe(uuid,uuid,boolean) TO service_role;
