-- Employee payout channels + installment scheduling: NO payroll pay/settlement RPC.
-- Sensitive identifiers are encrypted by Supabase Vault; app tables only expose masked values.
ALTER TABLE public.employee_payment_methods
  ALTER COLUMN encrypted_reference DROP NOT NULL;
ALTER TABLE public.employee_payment_methods
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.app_users(id);
ALTER TABLE public.salary_advances
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS installment_count integer,
  ADD COLUMN IF NOT EXISTS first_deduction_date date;
ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_installment_count_check;
ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_installment_count_check
 CHECK (installment_count IS NULL OR installment_count BETWEEN 1 AND 24);
ALTER TABLE public.employee_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_payment_methods,public.salary_advances FROM PUBLIC,anon,authenticated;

-- The employee may register their own payee, or the manager may help them.
-- Neither is permission to approve/transfer. One existing manager must review independently.
CREATE OR REPLACE FUNCTION public.hr_register_employee_payee(
 p_actor_id uuid,p_employee_id uuid,p_type text,p_reference text,p_bank_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE e public.employees%ROWTYPE;v_id uuid:=gen_random_uuid();
 v_ref text;v_mask text;v_vault uuid;v_bank text;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND employment_status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.station_modules sm
 WHERE sm.station_id=e.station_id AND sm.module_code='hr_payroll' AND sm.status='enabled')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 v_ref:=regexp_replace(coalesce(p_reference,''),'[ -]','','g');
 IF p_type='promptpay_phone' AND v_ref ~ '^0[689][0-9]{8}$' THEN
    v_mask:='0••-•••-'||right(v_ref,4);v_bank:=NULL;
 ELSIF p_type='promptpay_national_id' AND v_ref ~ '^[0-9]{13}$' THEN
    v_mask:='•••••••••'||right(v_ref,4);v_bank:=NULL;
 ELSIF p_type='bank_account' AND v_ref ~ '^[0-9]{7,16}$'
    AND p_bank_code ~ '^[A-Z0-9]{2,10}$' THEN
    v_mask:='••••'||right(v_ref,4);v_bank:=p_bank_code;
 ELSE RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYEE';END IF;
 IF EXISTS(SELECT 1 FROM public.employee_payment_methods WHERE employee_id=e.id
  AND status='pending' AND payment_type=p_type AND masked_reference=v_mask
  AND bank_code IS NOT DISTINCT FROM v_bank) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DUPLICATE_PENDING_PAYEE';
 END IF;
 -- Only secret *names* and masked endings are visible in app tables.
 v_vault:=vault.create_secret(v_ref,'oilstation_payee_'||v_id::text,
  'OilStation employee payment destination',NULL);
 INSERT INTO public.employee_payment_methods(id,employee_id,payment_type,
   encrypted_reference,vault_secret_id,masked_reference,bank_code,is_primary,status,submitted_by)
 VALUES(v_id,e.id,p_type,NULL,v_vault,v_mask,v_bank,false,'pending',p_actor_id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'employee_payment_method',v_id::text,'payee_proposed',
  jsonb_build_object('type',p_type,'masked',v_mask));
 RETURN jsonb_build_object('id',v_id,'masked',v_mask,'type',p_type,'bankCode',v_bank,'status','pending');
END $f$;

CREATE OR REPLACE FUNCTION public.hr_list_employee_payees(
 p_actor_id uuid,p_employee_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE e public.employees%ROWTYPE;v_result jsonb;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'employeeId',p.employee_id,
 'type',p.payment_type,'masked',p.masked_reference,'bankCode',p.bank_code,
 'status',p.status,'isPrimary',p.is_primary,'verifiedName',p.verified_name,
 'submittedBySelf',p.submitted_by=p_actor_id) ORDER BY p.created_at DESC),'[]'::jsonb)
 INTO v_result FROM public.employee_payment_methods p WHERE p.employee_id=e.id;
 RETURN v_result;
END $f$;

CREATE OR REPLACE FUNCTION public.hr_review_employee_payee(
 p_actor_id uuid,p_method_id uuid,p_approved boolean,p_verified_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE p public.employee_payment_methods%ROWTYPE;e public.employees%ROWTYPE;
 v_status text;
BEGIN
 SELECT * INTO p FROM public.employee_payment_methods WHERE id=p_method_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO e FROM public.employees WHERE id=p.employee_id;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
 AND m.active AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_actor_id=p.submitted_by OR p_actor_id=e.user_id THEN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF p.status<>'pending' THEN
  RETURN jsonb_build_object('id',p.id,'status',p.status,'replayed',true);END IF;
 IF p_approved IS NULL OR (p_approved AND
  (p_verified_name IS NULL OR char_length(btrim(p_verified_name)) NOT BETWEEN 2 AND 120))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REVIEW';END IF;
 v_status:=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
 IF p_approved THEN
   UPDATE public.employee_payment_methods SET is_primary=false
    WHERE employee_id=e.id AND status='approved' AND is_primary;
 END IF;
 UPDATE public.employee_payment_methods SET status=v_status,is_primary=p_approved,
 verified_name=CASE WHEN p_approved THEN btrim(p_verified_name) ELSE NULL END,
 approved_by=p_actor_id,approved_at=clock_timestamp()
 WHERE id=p.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'employee_payment_method',p.id::text,'payee_reviewed',
 jsonb_build_object('status',v_status,'masked',p.masked_reference));
 RETURN jsonb_build_object('id',p.id,'status',v_status,'replayed',false);
END $f$;

-- Only a manager may request a manual *instruction*. Not proof of transfer or payment.
CREATE OR REPLACE FUNCTION public.hr_reveal_approved_payee(
 p_actor_id uuid,p_method_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE p public.employee_payment_methods%ROWTYPE;e public.employees%ROWTYPE;
 v_value text;
BEGIN
 SELECT * INTO p FROM public.employee_payment_methods WHERE id=p_method_id
  AND status='approved' AND vault_secret_id IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYEE_NOT_APPROVED';END IF;
 SELECT * INTO e FROM public.employees WHERE id=p.employee_id;
 IF p_actor_id=e.user_id OR NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=e.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE id=p.vault_secret_id;
 IF v_value IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYEE_UNAVAILABLE';END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,e.station_id,'employee_payment_method',p.id::text,'payee_transfer_instruction_opened');
 RETURN jsonb_build_object('id',p.id,'employeeId',e.id,'employeeName',e.display_name,
 'type',p.payment_type,'reference',v_value,'bankCode',p.bank_code,
 'verifiedName',p.verified_name,'masked',p.masked_reference,'status','instruction_only');
END $f$;

CREATE OR REPLACE FUNCTION public.hr_request_salary_advance_installments(
 p_actor_id uuid,p_employee_id uuid,p_amount_satang bigint,
 p_installments integer,p_first_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE e public.employees%ROWTYPE;v_id uuid:=gen_random_uuid();v_per bigint;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id AND employment_status='active';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.station_modules sm WHERE
 sm.station_id=e.station_id AND sm.module_code='hr_payroll' AND sm.status='enabled')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=e.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_amount_satang IS NULL OR p_amount_satang<1 OR p_amount_satang>999999999999
 OR p_installments IS NULL OR p_installments NOT BETWEEN 1 AND 24
 OR p_first_date IS NULL OR p_first_date<current_date
 OR p_first_date>current_date+730
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_ADVANCE_PLAN';END IF;
 IF e.payroll_frequency='semi_monthly' AND extract(day from p_first_date)<>15
  AND p_first_date<>(date_trunc('month',p_first_date)::date+interval '1 month - 1 day')::date
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_PAYROLL_DATE';END IF;
 IF EXISTS(SELECT 1 FROM public.salary_advances a WHERE a.employee_id=e.id
  AND a.status='requested')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PENDING_ADVANCE_EXISTS';END IF;
 v_per:=(p_amount_satang/p_installments);
 INSERT INTO public.salary_advances(id,employee_id,principal_satang,outstanding_satang,
 repayment_satang,start_period_policy,status,requested_by,installment_count,first_deduction_date)
 VALUES(v_id,e.id,p_amount_satang,p_amount_satang,
  CASE WHEN v_per=0 THEN 1 ELSE v_per END,'next','requested',
  p_actor_id,p_installments,p_first_date);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'salary_advance',v_id::text,'advance_requested',
 jsonb_build_object('amountSatang',p_amount_satang,'installments',p_installments,
 'firstDeductionDate',p_first_date));
 RETURN jsonb_build_object('id',v_id,'status','requested',
 'amountSatang',p_amount_satang,'installments',p_installments,
 'firstDeductionDate',p_first_date,'frequency',e.payroll_frequency);
END $f$;

CREATE OR REPLACE FUNCTION public.hr_list_salary_advances(
 p_actor_id uuid,p_employee_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE e public.employees%ROWTYPE;v_result jsonb;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'employeeId',a.employee_id,'status',a.status,'amountSatang',a.principal_satang,
 'outstandingSatang',a.outstanding_satang,'installments',a.installment_count,
 'firstDeductionDate',a.first_deduction_date,'frequency',e.payroll_frequency,
 'requestedBySelf',a.requested_by=p_actor_id)
 ORDER BY a.created_at DESC),'[]'::jsonb)
 INTO v_result FROM public.salary_advances a WHERE a.employee_id=e.id;
 RETURN v_result;
END $f$;

CREATE OR REPLACE FUNCTION public.hr_review_salary_advance(
 p_actor_id uuid,p_advance_id uuid,p_approved boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE a public.salary_advances%ROWTYPE;e public.employees%ROWTYPE;v_status text;
BEGIN
 SELECT * INTO a FROM public.salary_advances WHERE id=p_advance_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO e FROM public.employees WHERE id=a.employee_id;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
 AND m.active AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_actor_id=a.requested_by OR p_actor_id=e.user_id THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF a.status<>'requested' THEN
  RETURN jsonb_build_object('id',a.id,'status',a.status,'replayed',true);END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REVIEW';END IF;
 v_status:=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
 UPDATE public.salary_advances SET status=v_status,approved_by=p_actor_id WHERE id=a.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'salary_advance',a.id::text,'advance_reviewed',
  jsonb_build_object('status',v_status,'noDisbursement',true));
 RETURN jsonb_build_object('id',a.id,'status',v_status,'replayed',false,
 'disbursed',false,'deductible',false);
END $f$;

DO $acl$ BEGIN
 REVOKE ALL ON FUNCTION public.hr_register_employee_payee(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_list_employee_payees(uuid,uuid) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_review_employee_payee(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_reveal_approved_payee(uuid,uuid) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_request_salary_advance_installments(uuid,uuid,bigint,integer,date) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_list_salary_advances(uuid,uuid) FROM PUBLIC,anon,authenticated;
 REVOKE ALL ON FUNCTION public.hr_review_salary_advance(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION public.hr_register_employee_payee(uuid,uuid,text,text,text) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_list_employee_payees(uuid,uuid) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_review_employee_payee(uuid,uuid,boolean,text) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_reveal_approved_payee(uuid,uuid) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_request_salary_advance_installments(uuid,uuid,bigint,integer,date) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_list_salary_advances(uuid,uuid) TO service_role;
 GRANT EXECUTE ON FUNCTION public.hr_review_salary_advance(uuid,uuid,boolean) TO service_role;
END $acl$;
