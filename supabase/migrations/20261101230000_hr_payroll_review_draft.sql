-- Payroll drafts are review dossiers, NOT payment instructions. No bank
-- transfer, payout, advance-repayment ledger or salary settlement is performed.
ALTER TABLE public.payroll_runs
 ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES public.app_users(id),
 ADD COLUMN IF NOT EXISTS hr_reviewed_by uuid REFERENCES public.app_users(id),
 ADD COLUMN IF NOT EXISTS hr_reviewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS hr_one_active_run_per_period
 ON public.payroll_runs(payroll_period_id)
 WHERE status IN ('draft','review','approved','paying','paid','partial');
CREATE INDEX IF NOT EXISTS hr_payroll_period_station_window
 ON public.payroll_periods(station_id,starts_on,ends_on);

CREATE OR REPLACE FUNCTION public.hr_create_payroll_review_line(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date,
 p_base_satang bigint,p_ot_satang bigint,p_other_earnings_satang bigint,
 p_tax_satang bigint,p_social_satang bigint,p_other_deductions_satang bigint,
 p_adjustment_satang bigint,p_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.employees%ROWTYPE;v_evidence jsonb;
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
  OR (v_evidence->>'unreviewedPunches')::integer>0
  OR (v_evidence->>'rejectedPunches')::integer>0
  OR ((v_evidence->>'scheduledShifts')::integer>0
      AND (v_evidence->>'attendancePunches')::integer=0)
  OR (v_evidence->>'approvedPrimaryPayees')::integer<>1
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_EVIDENCE_UNREVIEWED';END IF;
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
   'reviewedEvidence',v_evidence,'documentedBasis',trim(p_basis),
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

CREATE OR REPLACE FUNCTION public.hr_review_payroll_draft_safe(
 p_actor_id uuid,p_run_id uuid,p_approved boolean,p_legal_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE r public.payroll_runs%ROWTYPE;period public.payroll_periods%ROWTYPE;
 v_count integer;v_old jsonb;v_new jsonb;ln record;v_status text;
BEGIN
 SELECT * INTO r FROM public.payroll_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO period FROM public.payroll_periods WHERE id=r.payroll_period_id FOR UPDATE;
 IF p_actor_id IS NOT DISTINCT FROM r.prepared_by THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=period.station_id
   AND m.role_code IN('station_owner','owner','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF r.status<>'draft' THEN RETURN pg_catalog.jsonb_build_object(
  'id',r.id,'status',r.status,'replayed',true,'payable',false,'posted',false);END IF;
 IF p_approved IS NULL OR p_legal_basis IS NULL
  OR char_length(trim(p_legal_basis)) NOT BETWEEN 30 AND 1000
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_REVIEW';END IF;
 SELECT count(*)::integer INTO v_count FROM public.payroll_lines
 WHERE payroll_run_id=r.id;
 IF v_count=0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMPTY_PAYROLL';END IF;
 IF p_approved THEN
  FOR ln IN SELECT * FROM public.payroll_lines WHERE payroll_run_id=r.id LOOP
   v_old:=ln.breakdown->'reviewedEvidence';
   v_new:=public.hr_payroll_readiness_evidence(
     p_actor_id,ln.employee_id,period.starts_on,period.ends_on+1);
   IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYROLL_SOURCE_CHANGED';END IF;
  END LOOP;
 END IF;
 v_status:=CASE WHEN p_approved THEN 'review' ELSE 'failed' END;
 UPDATE public.payroll_runs SET status=v_status,
  hr_reviewed_by=p_actor_id,hr_reviewed_at=pg_catalog.clock_timestamp()
 WHERE id=r.id;
 UPDATE public.payroll_periods SET status=CASE WHEN p_approved THEN 'review' ELSE 'draft' END
 WHERE id=period.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,period.station_id,'payroll_review',r.id::text,
  'payroll_source_and_statutory_inputs_reviewed',
  pg_catalog.jsonb_build_object('status',v_status,'lineCount',v_count,
   'documentedBasis',trim(p_legal_basis),'approvedForPayment',false,
   'noBankTransfer',true));
 RETURN pg_catalog.jsonb_build_object('id',r.id,'status',v_status,
  'reviewed',p_approved,'replayed',false,'lineCount',v_count,
  'payable',false,'posted',false,'paid',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_list_payroll_drafts_safe(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_data jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=p_station_id
   AND m.role_code IN('station_owner','owner','manager','hr_manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',r.id,'status',r.status,'periodStart',p.starts_on,
  'periodEndExclusive',p.ends_on+1,'frequency',p.frequency,
  'submittedBySelf',r.prepared_by=p_actor_id,
  'reviewedAt',r.hr_reviewed_at,
  'lines',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',l.id,'employeeId',l.employee_id,
    'grossSatang',l.gross_satang::text,'netSatang',l.net_satang::text,
    'taxSatang',l.tax_satang::text,'socialSecuritySatang',l.social_security_satang::text
  ) ORDER BY l.id),'[]'::jsonb) FROM public.payroll_lines l WHERE l.payroll_run_id=r.id),
  'payable',false,'posted',false) ORDER BY p.starts_on DESC,r.created_at DESC),'[]'::jsonb)
 INTO v_data FROM public.payroll_runs r JOIN public.payroll_periods p ON p.id=r.payroll_period_id
 WHERE p.station_id=p_station_id;
 RETURN v_data;
END $fn$;

REVOKE ALL ON FUNCTION public.hr_create_payroll_review_line(uuid,uuid,date,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_review_payroll_draft_safe(uuid,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_list_payroll_drafts_safe(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_create_payroll_review_line(uuid,uuid,date,date,bigint,bigint,bigint,bigint,bigint,bigint,bigint,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_review_payroll_draft_safe(uuid,uuid,boolean,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_list_payroll_drafts_safe(uuid,uuid)
 TO service_role;