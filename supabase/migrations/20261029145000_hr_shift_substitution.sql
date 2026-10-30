-- Retroactive shift substitution. The originally scheduled shift is
-- marked as "absence_review", not absent, while replacement is awaiting approval.
-- Rejected changes remain subject to manager review, not auto-deducted.
ALTER TABLE public.shift_change_requests
 ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.app_users(id);

CREATE OR REPLACE FUNCTION public.hr_request_shift_override(
 p_actor_id uuid,p_original_assignment_id uuid,p_new_template_id uuid,
 p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_orig public.shift_assignments%ROWTYPE;
 v_employee public.employees%ROWTYPE;v_template public.shift_templates%ROWTYPE;
 v_new_shift uuid:=gen_random_uuid();v_request_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO v_orig FROM public.shift_assignments
   WHERE id=p_original_assignment_id FOR UPDATE;
 IF NOT FOUND OR v_orig.status NOT IN ('scheduled','absence_review') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT';END IF;
 SELECT * INTO v_employee FROM public.employees WHERE id=v_orig.employee_id;
 SELECT * INTO v_template FROM public.shift_templates WHERE id=p_new_template_id AND active;
 IF v_template.station_id IS DISTINCT FROM v_employee.station_id
   OR v_orig.shift_template_id=p_new_template_id
   OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 4 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT (v_employee.user_id=p_actor_id OR EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=v_employee.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF EXISTS(SELECT 1 FROM public.shift_change_requests r
  WHERE r.original_assignment_id=p_original_assignment_id AND r.status='pending') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PENDING_REQUEST_EXISTS';
 END IF;
 IF EXISTS(SELECT 1 FROM public.shift_assignments a WHERE
   a.employee_id=v_orig.employee_id AND a.shift_date=v_orig.shift_date
   AND a.shift_template_id=p_new_template_id AND a.status<>'cancelled') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SHIFT_ALREADY_SCHEDULED';END IF;
 INSERT INTO public.shift_assignments(id,employee_id,shift_template_id,shift_date,status,
   replacement_of)
 VALUES(v_new_shift,v_orig.employee_id,p_new_template_id,v_orig.shift_date,
   'scheduled',v_orig.id);
 INSERT INTO public.shift_change_requests(id,employee_id,original_assignment_id,
  replacement_assignment_id,request_type,reason,status,requested_by)
 VALUES(v_request_id,v_orig.employee_id,v_orig.id,v_new_shift,'replace',btrim(p_reason),
  'pending',p_actor_id);
 UPDATE public.shift_assignments SET status='absence_review' WHERE id=v_orig.id;
 RETURN jsonb_build_object('requestId',v_request_id,'replacementAssignmentId',v_new_shift,
  'status','pending','originalAbsenceStatus','absence_review');
END $f$;

CREATE OR REPLACE FUNCTION public.hr_review_shift_override(
 p_actor_id uuid,p_request_id uuid,p_approved boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_request public.shift_change_requests%ROWTYPE;
 v_station uuid;
BEGIN
 SELECT * INTO v_request FROM public.shift_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT station_id INTO v_station FROM public.employees WHERE id=v_request.employee_id;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND
   ((m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=v_station
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF v_request.status<>'pending' THEN
 RETURN jsonb_build_object('status',v_request.status,'replayed',true);END IF;
 IF p_approved IS NULL OR p_actor_id=v_request.requested_by THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='APPROVAL_NOT_ALLOWED';END IF;
 UPDATE public.shift_change_requests SET
 status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
 approved_by=p_actor_id,approved_at=clock_timestamp() WHERE id=p_request_id;
 IF p_approved THEN
   UPDATE public.shift_assignments SET status='replaced',approved_by=p_actor_id
   WHERE id=v_request.original_assignment_id;
 ELSE
   -- Preserve replacement attendance (if any) for manual payroll review.
   UPDATE public.shift_assignments SET status='absence_review'
    WHERE id=v_request.original_assignment_id;
   UPDATE public.shift_assignments SET status='absence_review'
    WHERE id=v_request.replacement_assignment_id;
 END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,v_station,'shift_change_request',p_request_id::text,
   CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
 RETURN jsonb_build_object('status',CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
  'replayed',false);
END $f$;

REVOKE ALL ON FUNCTION public.hr_request_shift_override(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_review_shift_override(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_request_shift_override(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_review_shift_override(uuid,uuid,boolean) TO service_role;
