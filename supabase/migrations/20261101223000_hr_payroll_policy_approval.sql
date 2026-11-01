-- Payroll policy is station-owned and independently approved. Policy values
-- are configured by humans; no default legal allowance, tax or OT rate.
CREATE TABLE IF NOT EXISTS public.hr_station_payroll_policies(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 effective_from date NOT NULL,
 monthly_divisor_days integer NOT NULL CHECK (monthly_divisor_days BETWEEN 1 AND 31),
 normal_day_minutes integer NOT NULL CHECK (normal_day_minutes BETWEEN 240 AND 720),
 overtime_rate_bps integer NOT NULL CHECK (overtime_rate_bps BETWEEN 10000 AND 40000),
 annual_leave_days integer NOT NULL CHECK (annual_leave_days BETWEEN 0 AND 366),
 sick_leave_days integer NOT NULL CHECK (sick_leave_days BETWEEN 0 AND 366),
 personal_leave_days integer NOT NULL CHECK (personal_leave_days BETWEEN 0 AND 366),
 paid_annual boolean NOT NULL,
 paid_sick boolean NOT NULL,
 paid_personal boolean NOT NULL,
 policy_basis text NOT NULL CHECK (char_length(policy_basis) BETWEEN 20 AND 1000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 requested_by uuid NOT NULL REFERENCES public.app_users(id),
 approved_by uuid REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_station_payroll_active_date
 ON public.hr_station_payroll_policies(station_id,effective_from)
 WHERE status='approved';
CREATE UNIQUE INDEX IF NOT EXISTS hr_station_payroll_one_pending
 ON public.hr_station_payroll_policies(station_id) WHERE status='pending';
ALTER TABLE public.hr_station_payroll_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_station_payroll_policies FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_station_payroll_policies FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hr_station_payroll_policies TO service_role;

CREATE OR REPLACE FUNCTION public.hr_propose_payroll_policy(
 p_actor_id uuid,p_station_id uuid,p_effective_from date,
 p_divisor integer,p_day_minutes integer,p_ot_rate_bps integer,
 p_annual_days integer,p_sick_days integer,p_personal_days integer,
 p_paid_annual boolean,p_paid_sick boolean,p_paid_personal boolean,p_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid:=pg_catalog.gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=p_station_id
  AND m.role_code IN('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_effective_from IS NULL OR p_effective_from<current_date-365
  OR p_effective_from>current_date+730
  OR p_divisor IS NULL OR p_day_minutes IS NULL OR p_ot_rate_bps IS NULL
  OR p_annual_days IS NULL OR p_sick_days IS NULL OR p_personal_days IS NULL
  OR p_divisor NOT BETWEEN 1 AND 31 OR p_day_minutes NOT BETWEEN 240 AND 720
  OR p_ot_rate_bps NOT BETWEEN 10000 AND 40000
  OR p_annual_days NOT BETWEEN 0 AND 366 OR p_sick_days NOT BETWEEN 0 AND 366
  OR p_personal_days NOT BETWEEN 0 AND 366 OR p_paid_annual IS NULL
  OR p_paid_sick IS NULL OR p_paid_personal IS NULL
  OR p_basis IS NULL OR char_length(trim(p_basis)) NOT BETWEEN 20 AND 1000
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_POLICY';END IF;
 IF EXISTS(SELECT 1 FROM public.hr_station_payroll_policies p
  WHERE p.station_id=p_station_id AND p.status='pending')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PENDING_PAYROLL_POLICY';END IF;
 IF EXISTS(SELECT 1 FROM public.hr_station_payroll_policies p
  WHERE p.station_id=p_station_id AND p.effective_from=p_effective_from
  AND p.status='approved')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='POLICY_DATE_IN_USE';END IF;
 INSERT INTO public.hr_station_payroll_policies(id,station_id,effective_from,
  monthly_divisor_days,normal_day_minutes,overtime_rate_bps,
  annual_leave_days,sick_leave_days,personal_leave_days,
  paid_annual,paid_sick,paid_personal,policy_basis,requested_by)
 VALUES(v_id,p_station_id,p_effective_from,p_divisor,p_day_minutes,p_ot_rate_bps,
  p_annual_days,p_sick_days,p_personal_days,
  p_paid_annual,p_paid_sick,p_paid_personal,trim(p_basis),p_actor_id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'hr_payroll_policy',v_id::text,'payroll_policy_proposed',
  pg_catalog.jsonb_build_object('effectiveFrom',p_effective_from,
   'status','pending','noPaymentOrPayrollMutation',true));
 RETURN pg_catalog.jsonb_build_object('id',v_id,'status','pending','payable',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_review_payroll_policy(
 p_actor_id uuid,p_policy_id uuid,p_approved boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.hr_station_payroll_policies%ROWTYPE;v_status text;
BEGIN
 SELECT * INTO p FROM public.hr_station_payroll_policies WHERE id=p_policy_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF p.requested_by=p_actor_id THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=p.station_id
  AND m.role_code IN('station_owner','owner','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p.status<>'pending' THEN RETURN pg_catalog.jsonb_build_object(
  'id',p.id,'status',p.status,'replayed',true,'payable',false);END IF;
 IF p_approved IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REVIEW';END IF;
 v_status:=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
 UPDATE public.hr_station_payroll_policies
 SET status=v_status,approved_by=p_actor_id,approved_at=pg_catalog.clock_timestamp()
 WHERE id=p.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p.station_id,'hr_payroll_policy',p.id::text,'payroll_policy_reviewed',
  pg_catalog.jsonb_build_object('status',v_status,'noSalaryPayment',true));
 RETURN pg_catalog.jsonb_build_object('id',p.id,'status',v_status,
  'replayed',false,'payable',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_list_payroll_policies(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_data jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=p_station_id
  AND m.role_code IN('station_owner','owner','manager','hr_manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',p.id,'status',p.status,'effectiveFrom',p.effective_from,
  'monthlyDivisorDays',p.monthly_divisor_days,'normalDayMinutes',p.normal_day_minutes,
  'overtimeRateBps',p.overtime_rate_bps,'annualLeaveDays',p.annual_leave_days,
  'sickLeaveDays',p.sick_leave_days,'personalLeaveDays',p.personal_leave_days,
  'paidAnnual',p.paid_annual,'paidSick',p.paid_sick,'paidPersonal',p.paid_personal,
  'policyBasis',p.policy_basis,'submittedBySelf',p.requested_by=p_actor_id,
  'approvedAt',p.approved_at) ORDER BY p.created_at DESC),'[]'::jsonb)
 INTO v_data FROM public.hr_station_payroll_policies p WHERE p.station_id=p_station_id;
 RETURN v_data;
END $fn$;

REVOKE ALL ON FUNCTION public.hr_propose_payroll_policy(uuid,uuid,date,integer,integer,integer,integer,integer,integer,boolean,boolean,boolean,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_review_payroll_policy(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_list_payroll_policies(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_propose_payroll_policy(uuid,uuid,date,integer,integer,integer,integer,integer,integer,boolean,boolean,boolean,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_review_payroll_policy(uuid,uuid,boolean)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_list_payroll_policies(uuid,uuid)
 TO service_role;