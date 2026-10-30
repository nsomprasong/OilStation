CREATE OR REPLACE FUNCTION public.hr_station_pending_shift_changes(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id
     AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'requestId',r.id,'employeeId',r.employee_id,'employeeName',e.display_name,
  'originalAssignmentId',r.original_assignment_id,
  'originalShift',t1.name,'replacementShift',t2.name,
  'date',a.shift_date,'reason',r.reason,
  'requestedBy',r.requested_by,'status',r.status
 ) ORDER BY r.created_at),'[]'::jsonb)
 INTO result
 FROM public.shift_change_requests r
 JOIN public.employees e ON e.id=r.employee_id
 JOIN public.shift_assignments a ON a.id=r.original_assignment_id
 JOIN public.shift_assignments b ON b.id=r.replacement_assignment_id
 JOIN public.shift_templates t1 ON t1.id=a.shift_template_id
 JOIN public.shift_templates t2 ON t2.id=b.shift_template_id
 WHERE e.station_id=p_station_id AND r.status='pending';
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.hr_station_pending_shift_changes(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_station_pending_shift_changes(uuid,uuid) TO service_role;
