-- QA-20261104-HR-PAYROLL-DUAL-REVIEW-002
-- Isolated PostgreSQL 16 only. All rows are fictional and rolled back.
-- Requires metadata fixture, original draft/review SQL, attendance provenance,
-- and latest unreconciled-advance guard. No customer Supabase connection.
BEGIN;
INSERT INTO public.organizations(id,name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST ONLY payroll org');
INSERT INTO public.stations(id,organization_id,name)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST only primary station'),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST only foreign station');
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.app_users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.memberships(user_id,role_code,scope_type,station_id)
VALUES
 ('11111111-1111-4111-8111-111111111111','hr_manager','station',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('33333333-3333-4333-8333-333333333333','station_owner','station',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('44444444-4444-4444-8444-444444444444','station_owner','station',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.employees(
 id,station_id,employee_code,display_name,employment_status,
 wage_type,wage_satang,payroll_frequency)
VALUES ('22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST_DUAL_REVIEW',
 'TEST ONLY employee','active','daily',45000,'monthly');

-- Contract-matching stand-ins for trusted evidence providers. The
-- actual draft/review and advance-guard functions execute unmodified.
CREATE OR REPLACE FUNCTION public.hr_payroll_readiness_evidence(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE sql VOLATILE SET search_path='' AS $readiness$
 SELECT pg_catalog.jsonb_build_object(
   'policyReviewed',true,'pendingLeave',0,'pendingOt',0,
   'attendancePunches',2,'unreviewedPunches',0,'rejectedPunches',0,
   'scheduledShifts',1,'approvedPrimaryPayees',1,
   'openAdvances',COALESCE(pg_catalog.current_setting('qa.open_advances',true),'0')::integer
 );
$readiness$;
CREATE OR REPLACE FUNCTION public.hr_reviewed_attendance_punches_local(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $attendance$
BEGIN
 IF pg_catalog.current_setting('qa.attendance_mode',true)='incomplete'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PUNCH_REVIEW_REQUIRED';END IF;
 RETURN pg_catalog.jsonb_build_object(
  'status','preview_only','payable',false,'faceVerified',false,
  'events',pg_catalog.jsonb_build_array(
   pg_catalog.jsonb_build_object('eventType','clock_in',
    'occurredAt',(p_start_date + time '08:00') AT TIME ZONE 'Asia/Bangkok'),
   pg_catalog.jsonb_build_object('eventType','clock_out',
    'occurredAt',(p_start_date + time '16:00') AT TIME ZONE 'Asia/Bangkok')
  ));
END $attendance$;

DO $scenario$
DECLARE
 preparer uuid:='11111111-1111-4111-8111-111111111111';
 reviewer uuid:='33333333-3333-4333-8333-333333333333';
 foreign_user uuid:='44444444-4444-4444-8444-444444444444';
 employee uuid:='22222222-2222-4222-8222-222222222222';
 period_start date:=date_trunc('month',current_date)::date;
 period_end date:=(date_trunc('month',current_date)+interval '1 month')::date;
 result jsonb; run_id uuid; event_count integer; blocked boolean;
BEGIN
 PERFORM pg_catalog.set_config('qa.open_advances','8',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(preparer,employee,period_start,period_end,
   45000,10125,0,0,0,0,0,'Isolated payroll test: advance not disbursed, reject review draft.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_EVIDENCE_UNREVIEWED';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'OPEN_ADVANCE_DRAFT_NOT_BLOCKED';END IF;

 PERFORM pg_catalog.set_config('qa.open_advances','0',true);
 PERFORM pg_catalog.set_config('qa.attendance_mode','incomplete',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(preparer,employee,period_start,period_end,
   45000,10125,0,0,0,0,0,'Isolated payroll test: incomplete attendance must block draft.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_EVIDENCE_UNREVIEWED';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'INCOMPLETE_ATTENDANCE_NOT_BLOCKED';END IF;

 PERFORM pg_catalog.set_config('qa.attendance_mode','complete',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(foreign_user,employee,period_start,period_end,
   45000,10125,0,0,0,0,0,'Isolated payroll test: foreign employee access must be denied.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='FORBIDDEN';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FOREIGN_PREPARER_ALLOWED';END IF;

 result:=public.hr_create_payroll_review_line(preparer,employee,period_start,period_end,
  45000,10125,0,0,0,0,0,'Isolated payroll test: fictitious wage and reviewed attendance only.');
 run_id:=(result->>'runId')::uuid;
 IF result->>'status'<>'draft' OR result->>'payable'<>'false'
 OR result->>'paid'<>'false' OR result->>'posted'<>'false'
 THEN RAISE EXCEPTION 'DRAFT_NOT_SAFE:%',result;END IF;
 IF (SELECT count(*) FROM public.payroll_periods)<>1
 OR (SELECT count(*) FROM public.payroll_runs)<>1
 OR (SELECT count(*) FROM public.payroll_lines)<>1
 THEN RAISE EXCEPTION 'DRAFT_CARDINALITY_BAD';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(preparer,employee,period_start,period_end,
   45000,10125,0,0,0,0,0,'Isolated payroll test: duplicate wage line must be rejected.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='DUPLICATE_PAYROLL_LINE';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'DUPLICATE_DRAFT_ALLOWED';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.hr_review_payroll_draft_safe(preparer,run_id,true,
   'Isolated payroll test: self review should be forbidden even after creating draft.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='SELF_APPROVAL_FORBIDDEN';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'SELF_REVIEW_ALLOWED';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.hr_review_payroll_draft_safe(foreign_user,run_id,true,
   'Isolated payroll test: foreign station reviewer cannot approve this salary.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='FORBIDDEN';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FOREIGN_REVIEW_ALLOWED';END IF;

 PERFORM pg_catalog.set_config('qa.open_advances','1',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_review_payroll_draft_safe(reviewer,run_id,true,
   'Isolated payroll test: changed advance evidence must stop approval of old draft.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_SOURCE_CHANGED';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'STALE_ADVANCE_EVIDENCE_ALLOWED';END IF;

 PERFORM pg_catalog.set_config('qa.open_advances','0',true);
 PERFORM pg_catalog.set_config('qa.attendance_mode','incomplete',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_review_payroll_draft_safe(reviewer,run_id,true,
   'Isolated payroll test: changed attendance provenance must stop approval.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_SOURCE_CHANGED';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'STALE_ATTENDANCE_EVIDENCE_ALLOWED';END IF;
 PERFORM pg_catalog.set_config('qa.attendance_mode','complete',true);

 result:=public.hr_review_payroll_draft_safe(reviewer,run_id,true,
  'Isolated payroll test: independent review of source and statutory documents only.');
 IF result->>'status'<>'review' OR result->>'reviewed'<>'true'
 OR result->>'payable'<>'false' OR result->>'posted'<>'false'
 OR result->>'paid'<>'false' OR result->>'replayed'<>'false'
 THEN RAISE EXCEPTION 'INDEPENDENT_REVIEW_INVALID:%',result;END IF;
 SELECT count(*) INTO event_count FROM public.audit_events
 WHERE entity_type IN ('payroll_review','payroll_review_line');
 IF event_count<>2 THEN RAISE EXCEPTION 'REVIEW_AUDIT_COUNT:%',event_count;END IF;
 result:=public.hr_review_payroll_draft_safe(reviewer,run_id,true,
  'Isolated payroll test: repeated reviewer call must not create duplicate journal.');
 IF result->>'replayed'<>'true' OR result->>'status'<>'review'
 THEN RAISE EXCEPTION 'REVIEW_REPLAY_NOT_IDEMPOTENT:%',result;END IF;
 IF (SELECT count(*) FROM public.audit_events
 WHERE entity_type IN ('payroll_review','payroll_review_line'))<>2
 THEN RAISE EXCEPTION 'REPLAY_CREATED_DUPLICATE_AUDIT';END IF;

 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(preparer,employee,period_start,period_end,
   45000,10125,0,0,0,0,0,'Isolated payroll test: reviewed period cannot be silently redrafted.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_PERIOD_LOCKED';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'LOCKED_PERIOD_REDRAFT_ALLOWED';END IF;

 IF (SELECT status FROM public.payroll_runs WHERE id=run_id)<>'review'
 OR (SELECT status FROM public.payroll_periods WHERE id=(SELECT payroll_period_id
   FROM public.payroll_runs WHERE id=run_id))<>'review'
 OR (SELECT count(*) FROM public.payroll_payouts)<>0
 OR (SELECT count(*) FROM public.bank_export_batches)<>0
 OR (SELECT count(*) FROM public.advance_repayments)<>0
 THEN RAISE EXCEPTION 'UNEXPECTED_SETTLEMENT_OR_PERIOD_STATE';END IF;
 RAISE NOTICE 'PASS: real SQL create/review lifecycle, dual-control, stale-source, idempotency, zero payments';
END $scenario$;
ROLLBACK;

-- Test SQL is transaction-bound and left no synthetic tenants/finance rows.
DO $verify_empty$
BEGIN
 IF EXISTS(SELECT 1 FROM public.payroll_runs) OR
 EXISTS(SELECT 1 FROM public.payroll_lines) OR
 EXISTS(SELECT 1 FROM public.payroll_payouts) OR
 EXISTS(SELECT 1 FROM public.advance_repayments)
 THEN RAISE EXCEPTION 'ISOLATED_QA_ROLLBACK_FAILED';END IF;
 RAISE NOTICE 'PASS: disposable payroll test transaction rolled back';
END $verify_empty$;
