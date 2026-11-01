-- Match actual attendance review values (accepted/pending/rejected) and station timezone.
CREATE OR REPLACE FUNCTION public.hr_payroll_readiness_evidence(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.employees%ROWTYPE;
 v_pending_leave integer;v_approved_leave integer;v_unpaid_leave integer;
 v_pending_ot integer;v_approved_ot integer;
 v_punches integer;v_unreviewed_punches integer;v_rejected_punches integer;
 v_shifts integer;v_payee integer;v_unreconciled_advance integer;
 v_policy_id uuid;v_station_tz text;
BEGIN
 IF p_start_date IS NULL OR p_end_date IS NULL
  OR p_start_date>=p_end_date OR p_end_date-p_start_date>35
  OR p_start_date<current_date-366 OR p_start_date>current_date+366
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_DATE';END IF;
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 SELECT st.timezone INTO v_station_tz FROM public.stations st WHERE st.id=e.station_id;
 IF v_station_tz IS NULL OR v_station_tz='' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_DATE';END IF;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 -- Wage amounts and attendance evidence are privileged to station management.
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=e.station_id
   AND m.role_code IN ('station_owner','owner','manager','hr_manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT count(*) FILTER(WHERE l.status='pending')::integer,
        count(*) FILTER(WHERE l.status='approved')::integer,
        count(*) FILTER(WHERE l.status='approved' AND l.leave_type='unpaid')::integer
 INTO v_pending_leave,v_approved_leave,v_unpaid_leave
 FROM public.leave_requests l WHERE l.employee_id=e.id
  AND l.start_date<p_end_date AND l.end_date>=p_start_date;
 SELECT count(*) FILTER(WHERE o.status='pending')::integer,
        count(*) FILTER(WHERE o.status IN ('approved','partial'))::integer
 INTO v_pending_ot,v_approved_ot FROM public.overtime_requests o
 JOIN public.shift_assignments s ON s.id=o.shift_assignment_id
 WHERE o.employee_id=e.id AND s.shift_date>=p_start_date AND s.shift_date<p_end_date;
 SELECT count(*)::integer INTO v_shifts FROM public.shift_assignments s
 WHERE s.employee_id=e.id AND s.shift_date>=p_start_date AND s.shift_date<p_end_date
 AND s.status NOT IN ('replaced','cancelled');
 SELECT count(*)::integer,
        count(*) FILTER(WHERE a.review_status IS DISTINCT FROM 'accepted')::integer,
        count(*) FILTER(WHERE a.review_status='rejected')::integer
 INTO v_punches,v_unreviewed_punches,v_rejected_punches
 FROM public.attendance_events a WHERE a.employee_id=e.id
 AND (a.occurred_at AT TIME ZONE v_station_tz)::date>=p_start_date
 AND (a.occurred_at AT TIME ZONE v_station_tz)::date<p_end_date;
 SELECT count(*)::integer INTO v_payee FROM public.employee_payment_methods p
 WHERE p.employee_id=e.id AND p.status='approved' AND p.is_primary=true;
 SELECT count(*)::integer INTO v_unreconciled_advance FROM public.salary_advances a
 WHERE a.employee_id=e.id AND a.status IN ('requested','approved','paid') AND a.outstanding_satang>0;
 SELECT p.id INTO v_policy_id
 FROM public.hr_station_payroll_policies p
 WHERE p.station_id=e.station_id AND p.status='approved'
 AND p.effective_from<=p_start_date
 ORDER BY p.effective_from DESC,p.approved_at DESC LIMIT 1;
 RETURN jsonb_build_object(
  'employeeId',e.id,'stationId',e.station_id,'employeeStatus',e.employment_status,
  'wageType',e.wage_type,'wageSatang',coalesce(e.wage_satang,0)::text,
  'payrollFrequency',e.payroll_frequency,'startDate',p_start_date,'endDate',p_end_date,
  'pendingLeave',v_pending_leave,'approvedLeave',v_approved_leave,
  'approvedUnpaidLeave',v_unpaid_leave,'pendingOt',v_pending_ot,
  'approvedOt',v_approved_ot,'scheduledShifts',v_shifts,
  'attendancePunches',v_punches,'unreviewedPunches',v_unreviewed_punches,
  'rejectedPunches',v_rejected_punches,'approvedPrimaryPayees',v_payee,
  'openAdvances',v_unreconciled_advance,
  'stationLocalTimezone',v_station_tz,'policyReviewed',v_policy_id IS NOT NULL,'policyId',v_policy_id,
  'statutoryReviewed',false,'payable',false,'postedSatang',0,'readOnly',true
 );
END $fn$;
REVOKE ALL ON FUNCTION public.hr_payroll_readiness_evidence(uuid,uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_payroll_readiness_evidence(uuid,uuid,date,date) TO service_role;
