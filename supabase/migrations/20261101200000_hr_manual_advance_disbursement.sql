-- Out-of-bank-integration manual advance reconciliation. Does NOT transfer money.
-- Operator provides real external transaction reference; a different reviewer
-- must attest against the bank statement. Never auto-deduct payroll.
CREATE TABLE IF NOT EXISTS public.hr_advance_disbursement_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 advance_id uuid NOT NULL REFERENCES public.salary_advances(id),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 payment_method_id uuid NOT NULL REFERENCES public.employee_payment_methods(id),
 amount_satang bigint NOT NULL CHECK(amount_satang>0),
 bank_reference text NOT NULL CHECK(bank_reference ~ '^[A-Z0-9-]{8,80}$'),
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','confirmed','rejected')),
 submitted_by uuid NOT NULL REFERENCES public.app_users(id),
 reviewed_by uuid REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_advance_claim_txn_station_unique
 ON public.hr_advance_disbursement_claims(station_id,bank_reference);
CREATE UNIQUE INDEX IF NOT EXISTS hr_advance_one_pending_or_confirmed
 ON public.hr_advance_disbursement_claims(advance_id)
 WHERE status IN ('pending','confirmed');
CREATE INDEX IF NOT EXISTS hr_advance_claim_station_pending
 ON public.hr_advance_disbursement_claims(station_id,created_at)
 WHERE status='pending';
ALTER TABLE public.hr_advance_disbursement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_advance_disbursement_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_advance_disbursement_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.hr_advance_disbursement_claims TO service_role;

ALTER TABLE public.salary_advances
 ADD COLUMN IF NOT EXISTS disbursed_at timestamptz,
 ADD COLUMN IF NOT EXISTS disbursement_claim_id uuid REFERENCES public.hr_advance_disbursement_claims(id);

CREATE OR REPLACE FUNCTION public.hr_advance_submit_manual_confirmation(
 p_actor_id uuid,p_advance_id uuid,p_method_id uuid,p_bank_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE a public.salary_advances%ROWTYPE;e public.employees%ROWTYPE;
 p public.employee_payment_methods%ROWTYPE;v_id uuid:=gen_random_uuid();v_ref text;
BEGIN
 SELECT * INTO a FROM public.salary_advances WHERE id=p_advance_id FOR UPDATE;
 IF NOT FOUND OR a.status<>'approved' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ADVANCE_NOT_APPROVED';END IF;
 SELECT * INTO e FROM public.employees WHERE id=a.employee_id;
 IF p_actor_id=e.user_id OR NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO p FROM public.employee_payment_methods
 WHERE id=p_method_id AND employee_id=e.id AND is_primary AND status='approved';
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYEE_NOT_APPROVED';END IF;
 v_ref:=upper(btrim(coalesce(p_bank_reference,'')));
 IF v_ref !~ '^[A-Z0-9-]{8,80}$' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BANK_REFERENCE';END IF;
 IF EXISTS(SELECT 1 FROM public.hr_advance_disbursement_claims
  WHERE advance_id=a.id AND status IN ('pending','confirmed'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='CLAIM_ALREADY_EXISTS';END IF;
 INSERT INTO public.hr_advance_disbursement_claims(
  id,advance_id,station_id,payment_method_id,amount_satang,bank_reference,submitted_by)
 VALUES(v_id,a.id,e.station_id,p.id,a.principal_satang,v_ref,p_actor_id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'advance_disbursement_claim',v_id::text,
  'external_transfer_submitted_for_review',
  jsonb_build_object('advanceId',a.id,'amountSatang',a.principal_satang,
    'payeeMasked',p.masked_reference,'status','pending'));
 RETURN jsonb_build_object('id',v_id,'status','pending','advanceId',a.id,
   'amountSatang',a.principal_satang,'transferExecutedBySystem',false,
   'disbursed',false,'deducted',false);
END $f$;

CREATE OR REPLACE FUNCTION public.hr_advance_list_manual_confirmations(
 p_actor_id uuid,p_employee_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE e public.employees%ROWTYPE;v_items jsonb;
BEGIN
 SELECT * INTO e FROM public.employees WHERE id=p_employee_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF e.user_id IS DISTINCT FROM p_actor_id AND NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=e.station_id
 AND m.role_code IN ('station_owner','owner','manager','hr_manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'advanceId',c.advance_id,'status',c.status,
  'amountSatang',c.amount_satang,'maskedPayee',p.masked_reference,
  'maskedBankReference','••••'||right(c.bank_reference,4),
  'submittedBySelf',c.submitted_by=p_actor_id,
  'createdAt',c.created_at) ORDER BY c.created_at DESC),'[]'::jsonb)
 INTO v_items FROM public.hr_advance_disbursement_claims c
 JOIN public.salary_advances a ON a.id=c.advance_id
 JOIN public.employee_payment_methods p ON p.id=c.payment_method_id
 WHERE a.employee_id=e.id;
 RETURN v_items;
END $f$;

CREATE OR REPLACE FUNCTION public.hr_advance_review_manual_confirmation(
 p_actor_id uuid,p_claim_id uuid,p_verified boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE c public.hr_advance_disbursement_claims%ROWTYPE;
 a public.salary_advances%ROWTYPE;e public.employees%ROWTYPE;
 v_status text;
BEGIN
 SELECT * INTO c FROM public.hr_advance_disbursement_claims
 WHERE id=p_claim_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO a FROM public.salary_advances WHERE id=c.advance_id FOR UPDATE;
 SELECT * INTO e FROM public.employees WHERE id=a.employee_id;
 IF p_actor_id=c.submitted_by OR p_actor_id=e.user_id OR NOT EXISTS(
 SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
 AND m.scope_type='station' AND m.station_id=c.station_id
 AND m.role_code IN ('station_owner','owner','manager','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';END IF;
 IF c.status<>'pending' THEN RETURN jsonb_build_object(
   'id',c.id,'status',c.status,'replayed',true,'deducted',false);END IF;
 IF p_verified IS NULL OR a.status<>'approved' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REVIEW';END IF;
 v_status:=CASE WHEN p_verified THEN 'confirmed' ELSE 'rejected' END;
 UPDATE public.hr_advance_disbursement_claims
 SET status=v_status,reviewed_by=p_actor_id,reviewed_at=clock_timestamp()
 WHERE id=c.id;
 IF p_verified THEN
  -- Two independent humans attested external bank reconciliation. No transfer occurs here.
  UPDATE public.salary_advances SET status='paid',disbursed_at=clock_timestamp(),
   disbursement_claim_id=c.id WHERE id=a.id AND status='approved';
 END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,e.station_id,'advance_disbursement_claim',c.id::text,
 'manual_bank_transfer_reviewed',
 jsonb_build_object('status',v_status,'amountSatang',c.amount_satang,
  'noPayrollDeduction',true,'automaticBankTransfer',false));
 RETURN jsonb_build_object('id',c.id,'status',v_status,'replayed',false,
 'disbursed',p_verified,'deducted',false,'bankConfirmedByHumans',p_verified,
 'automaticBankTransfer',false);
END $f$;

REVOKE ALL ON FUNCTION public.hr_advance_submit_manual_confirmation(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_advance_list_manual_confirmations(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_advance_review_manual_confirmation(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_advance_submit_manual_confirmation(uuid,uuid,uuid,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_advance_list_manual_confirmations(uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_advance_review_manual_confirmation(uuid,uuid,boolean)
 TO service_role;