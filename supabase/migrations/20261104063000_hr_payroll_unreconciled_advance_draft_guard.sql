-- Forward-only fail-closed payroll draft guard. Review-only; never posts wages.
-- In the shared QA project an employee has unsettled advances, which the
-- readiness endpoint blocks, but the original draft SQL did not explicitly
-- check. This closes that bypass without changing historical migrations.
-- Source of this function body: 20261101233000_hr_payroll_manual_punch_provenance.sql.
CREATE OR REPLACE FUNCTION public.hr_create_payroll_review_line(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date,
 p_base_satang bigint,p_ot_satang bigint,p_other_earnings_satang bigint,
 p_tax_satang bigint,p_social_satang bigint,p_other_deductions_satang bigint,
 p_adjustment_satang bigint,p_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.employees%ROWTYPE;v_evidence jsonb;v_time jsonb;v_event jsonb;
 v_kind text;v_active boolean:=false;v_break boolean:=false;
 v_last timestamptz;v_shift_start timestamptz;v_now timestamptz;
 v_period uuid;v_run uuid;v_line uuid;
 v_gross bigint;v_deductions bigint;v_net bigint;
 v_freq text;v_run_status text;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND OR e.employment_status<>'active' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMPLOYEE_NOT_ELIGIBLE';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=e.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date<=p_start_date
  OR p_end_date-p_start_date>35
  OR p_start_date<current_date-366 OR p_start_date>current_date+366
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_DATE';END IF;
 IF p_base_satang IS NULL OR p_ot_satang IS NULL OR p_other_earnings_satang IS NULL
  OR p_tax_satang IS NULL OR p_social_satang IS NULL
  OR p_other_deductions_satang IS NULL OR p_adjustment_satang IS NULL
  OR p_base_satang<0 OR p_ot_satang<0 OR p_other_earnings_satang<0
  OR p_tax_satang<0 OR p_social_satang<0 OR p_other_deductions_satang<0
  OR p_base_satang>10000000000 OR p_ot_satang>10000000000
  OR p_other_earnings_satang>10000000000 OR p_tax_satang>10000000000
  OR p_social_satang>10000000000 OR p_other_deductions_satang>10000000000
  OR p_adjustment_satang NOT BETWEEN -10000000000 AND 10000000000
  OR p_basis IS NULL OR char_length(trim(p_basis)) NOT BETWEEN 25 AND 1000
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_DRAFT';END IF;
 v_gross:=p_base_satang+p_ot_satang+p_other_earnings_satang+p_adjustment_satang;
 v_deductions:=p_tax_satang+p_social_satang+p_other_deductions_satang;
 v_net:=v_gross-v_deductions;
 IF v_net<0 OR v_gross<0 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NEGATIVE_NET_SALARY';END IF;
 v_freq:=e.payroll_frequency;
 IF v_freq IS NULL OR v_freq NOT IN ('monthly','semi_monthly','weekly')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FREQUENCY_NOT_CONFIGURED';END IF;
 v_evidence:=public.hr_payroll_readiness_evidence(
  p_actor_id,p_employee_id,p_start_date,p_end_date);
 IF v_evidence->>'policyReviewed'<>'true'
  OR (v_evidence->>'pendingLeave')::integer>0
  OR (v_evidence->>'pendingOt')::integer>0
  OR (v_evidence->>'attendancePunches')::integer=0
  OR (v_evidence->>'unreviewedPunches')::integer>0
  OR (v_evidence->>'rejectedPunches')::integer>0
  OR ((v_evidence->>'scheduledShifts')::integer>0
      AND (v_evidence->>'attendancePunches')::integer=0)
  OR (v_evidence->>'approvedPrimaryPayees')::integer<>1
  -- The readiness screen already blocks unreconciled/undisbursed advances.
  -- Enforce the exact same guard at the trusted SQL draft-creation boundary.
  -- Missing evidence fails closed; no implicit payroll deduction is permitted.
  OR COALESCE((v_evidence->>'openAdvances')::integer,-1)<>0
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
 -- Payroll evidence must be independently supervisor-reviewed, not merely
 -- a row flagged accepted. Also verify complete clock-in/out/break pairs.
 BEGIN
  v_time:=public.hr_reviewed_attendance_punches_local(
   p_actor_id,p_employee_id,p_start_date,p_end_date);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';
 END;
 IF v_time->>'status'<>'preview_only' OR v_time->>'payable'<>'false'
  OR v_time->>'faceVerified'<>'false'
  OR jsonb_typeof(v_time->'events')<>'array'
  OR jsonb_array_length(v_time->'events')<2
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
 FOR v_event IN SELECT value FROM pg_catalog.jsonb_array_elements(v_time->'events') LOOP
  v_kind:=v_event->>'eventType';
  v_now:=(v_event->>'occurredAt')::timestamptz;
  IF v_last IS NOT NULL AND v_now<=v_last THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
  IF v_kind='clock_in' THEN
   IF v_active OR v_break THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
   v_active:=true;v_shift_start:=v_now;
  ELSIF v_kind='clock_out' THEN
   IF NOT v_active OR v_break OR v_now-v_shift_start>interval '24 hours' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
   v_active:=false;
  ELSIF v_kind='break_start' THEN
   IF NOT v_active OR v_break THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
   v_break:=true;
  ELSIF v_kind='break_end' THEN
   IF NOT v_active OR NOT v_break THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
   v_break:=false;
  ELSE
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';
  END IF;
  v_last:=v_now;
 END LOOP;
 IF v_active OR v_break THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
 -- Once approved/paid, no re-draft can silently change the same period.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(e.station_id::text||p_start_date::text||p_end_date::text||v_freq,2));
 SELECT id INTO v_period FROM public.payroll_periods
 WHERE station_id=e.station_id AND starts_on=p_start_date
  AND ends_on=p_end_date-1 AND frequency=v_freq FOR UPDATE;
 IF v_period IS NULL THEN
  INSERT INTO public.payroll_periods(station_id,starts_on,ends_on,frequency,status)
  VALUES(e.station_id,p_start_date,p_end_date-1,v_freq,'draft') RETURNING id INTO v_period;
 END IF;
 SELECT r.id,r.status INTO v_run,v_run_status FROM public.payroll_runs r
 WHERE r.payroll_period_id=v_period AND r.status<>'failed'
 ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE;
 IF v_run IS NULL THEN
  INSERT INTO public.payroll_runs(payroll_period_id,status,prepared_by)
  VALUES(v_period,'draft',p_actor_id) RETURNING id INTO v_run;
 ELSIF v_run_status<>'draft' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_PERIOD_LOCKED';
 END IF;
 IF EXISTS(SELECT 1 FROM public.payroll_lines WHERE payroll_run_id=v_run
 AND employee_id=e.id) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DUPLICATE_PAYROLL_LINE';END IF;
 INSERT INTO public.payroll_lines(payroll_run_id,employee_id,gross_satang,tax_satang,
  social_security_satang,deductions_satang,adjustments_satang,net_satang,breakdown)
 VALUES(v_run,e.id,v_gross,p_tax_satang,p_social_satang,v_deductions,
  p_adjustment_satang,v_net,pg_catalog.jsonb_build_object(
   'baseSatang',p_base_satang::text,'otSatang',p_ot_satang::text,
   'otherEarningsSatang',p_other_earnings_satang::text,
   'otherDeductionsSatang',p_other_deductions_satang::text,
   'advanceRepaymentSatang','0',
   'policyId',v_evidence->'policyId',
   'reviewedEvidence',v_evidence,'verifiedPunches',v_time,'documentedBasis',trim(p_basis),
   'statutoryInputsManuallyEntered',true,'noPaymentOrDeduction',true))
 RETURNING id INTO v_line;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'payroll_review_line',v_line::text,
  'payroll_draft_line_prepared',pg_catalog.jsonb_build_object(
   'runId',v_run,'grossSatang',v_gross,'netSatang',v_net,'noMoneyTransfer',true));
 RETURN pg_catalog.jsonb_build_object('runId',v_run,'lineId',v_line,
  'status','draft','grossSatang',v_gross::text,'netSatang',v_net::text,
  'payable',false,'paid',false,'posted',false);
END $fn$;

REVOKE ALL ON FUNCTION public.hr_create_payroll_review_line(uuid,uuid,date,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_create_payroll_review_line(uuid,uuid,date,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text)
 TO service_role;
