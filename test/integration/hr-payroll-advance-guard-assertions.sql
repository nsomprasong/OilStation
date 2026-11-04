-- Disposable PostgreSQL test. This runs against metadata-only public fixtures:
-- never against the live Supabase project, never using real employee records.
BEGIN;
INSERT INTO public.organizations(id,name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic payroll-only organization');
INSERT INTO public.stations(id,organization_id,name)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic station');
-- In the live-shaped fixture public.app_users references auth.users.
INSERT INTO auth.users(id)
VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.app_users(id)
VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.memberships(user_id,role_code,scope_type,station_id)
VALUES ('11111111-1111-4111-8111-111111111111','hr_manager','station',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.employees(id,station_id,employee_code,display_name,
 employment_status,wage_type,wage_satang,payroll_frequency)
VALUES ('22222222-2222-4222-8222-222222222222',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'QA_PAYROLL_GUARD_ONLY','Synthetic employee','active','monthly',3000000,'monthly');

-- Mimic the actual trusted scoped readiness RPC contract, not external data.
-- Changing the session GUC simulates unresolved, missing, and resolved evidence.
CREATE OR REPLACE FUNCTION public.hr_payroll_readiness_evidence(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE sql VOLATILE SET search_path='' AS $e$
 SELECT (
   '{"policyReviewed":true,"pendingLeave":0,"pendingOt":0,
      "attendancePunches":2,"unreviewedPunches":0,"rejectedPunches":0,
      "scheduledShifts":1,"approvedPrimaryPayees":1}'::jsonb
   || CASE WHEN pg_catalog.current_setting('qa.open_advances',true)='missing'
      THEN '{}'::jsonb
      ELSE pg_catalog.jsonb_build_object('openAdvances',
       pg_catalog.current_setting('qa.open_advances',true)::integer) END
 );
$e$;
CREATE OR REPLACE FUNCTION public.hr_reviewed_attendance_punches_local(
 p_actor_id uuid,p_employee_id uuid,p_start_date date,p_end_date date
) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $e$
 BEGIN
  RAISE EXCEPTION USING ERRCODE='P9999',MESSAGE='REACHED_ATTENDANCE_GATE';
 END $e$;

DO $verify$
DECLARE
 actor uuid:='11111111-1111-4111-8111-111111111111';
 employee uuid:='22222222-2222-4222-8222-222222222222';
 period_start date:=date_trunc('month',current_date)::date;
 period_end date:=(date_trunc('month',current_date)+interval '1 month')::date;
 count_value text;
 blocked boolean;
BEGIN
 FOREACH count_value IN ARRAY ARRAY['8','1','missing'] LOOP
  PERFORM pg_catalog.set_config('qa.open_advances',count_value,true);
  blocked:=false;
  BEGIN
   PERFORM public.hr_create_payroll_review_line(
    actor,employee,period_start,period_end,3000000,0,0,0,0,0,0,
    'Isolated PostgreSQL QA payroll basis: never financial settlement.');
  EXCEPTION WHEN OTHERS THEN
   blocked:=SQLSTATE='P0001' AND SQLERRM='PAYROLL_EVIDENCE_UNREVIEWED';
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'OPEN_ADVANCE_GUARD_FAILED:%',count_value; END IF;
 END LOOP;

 -- Only a zero advance counter may proceed past the new guard to the
 -- existing independent/manual attendance provenance gate.
 PERFORM pg_catalog.set_config('qa.open_advances','0',true);
 blocked:=false;
 BEGIN
  PERFORM public.hr_create_payroll_review_line(
   actor,employee,period_start,period_end,3000000,0,0,0,0,0,0,
   'Isolated PostgreSQL QA payroll basis: never financial settlement.');
 EXCEPTION WHEN OTHERS THEN
  blocked:=SQLSTATE='P9999' AND SQLERRM='REACHED_ATTENDANCE_GATE';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'CLEAN_ADVANCE_BLOCKED_BEFORE_ATTENDANCE'; END IF;

 IF (SELECT count(*) FROM public.payroll_periods)<>0 OR
    (SELECT count(*) FROM public.payroll_runs)<>0 OR
    (SELECT count(*) FROM public.payroll_lines)<>0 OR
    (SELECT count(*) FROM public.payroll_payouts)<>0 OR
    (SELECT count(*) FROM public.advance_repayments)<>0
 THEN RAISE EXCEPTION 'PAYROLL_GUARD_INSERTED_FINANCIAL_ROWS'; END IF;
 RAISE NOTICE 'PASS: open/missing advances blocked; zero advances reaches next gate; no payroll rows';
END $verify$;
ROLLBACK;
