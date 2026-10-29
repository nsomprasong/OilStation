-- Manual station bank topup: never increases credit on slip upload.
-- Final approval after bank statement verification posts debt-first settlement
-- under a single wallet row lock and immutable financial journal event.
CREATE UNIQUE INDEX IF NOT EXISTS topup_approved_unique_bank_ref
 ON public.topup_requests(station_bank_id,bank_reference)
 WHERE status='approved' AND bank_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.request_corporate_topup(
 p_actor_id uuid,p_account_id uuid,p_station_bank_id uuid,
 p_amount_satang bigint,p_slip_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE a public.corporate_station_accounts%ROWTYPE;v_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.station_bank_accounts b
  WHERE b.id=p_station_bank_id AND b.station_id=a.station_id AND b.active) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BANK_ACCOUNT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='corporate_company' AND m.corporate_company_id=a.company_id
  AND (m.role_code IN ('corporate_admin','accountant','finance_manager')
   OR m.extra_permissions->>'request_topup'='true')) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_amount_satang IS NULL OR p_amount_satang<=0
  OR p_slip_path IS NULL OR char_length(p_slip_path) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.topup_requests(id,account_id,station_bank_id,amount_satang,
  slip_storage_path,requested_by,status)
 VALUES(v_id,p_account_id,p_station_bank_id,p_amount_satang,p_slip_path,
  p_actor_id,'pending');
 RETURN jsonb_build_object('requestId',v_id,'status','pending');
END $f$;

CREATE OR REPLACE FUNCTION public.review_corporate_topup(
 p_actor_id uuid,p_request_id uuid,p_approved boolean,
 p_bank_received boolean,p_verified_bank_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 t public.topup_requests%ROWTYPE;
 a public.corporate_station_accounts%ROWTYPE;
 v_remaining bigint;v_all_debt bigint;v_paid bigint:=0;
 v_payable bigint;v_ledger_prepaid bigint;
 v_ar public.accounts_receivable%ROWTYPE;
 v_ref text;
BEGIN
 SELECT * INTO t FROM public.topup_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=t.account_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=a.station_id
  AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
   OR m.extra_permissions->>'approve_topup'='true')) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF t.status<>'pending' THEN
  RETURN jsonb_build_object('requestId',t.id,'status',t.status,'replayed',true);
 END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT p_approved THEN
  UPDATE public.topup_requests SET status='rejected',reviewed_by=p_actor_id,
  reviewed_at=clock_timestamp() WHERE id=t.id;
  RETURN jsonb_build_object('requestId',t.id,'status','rejected','replayed',false);
 END IF;
 v_ref:=nullif(upper(btrim(p_verified_bank_reference)),'');
 IF p_bank_received IS DISTINCT FROM true OR v_ref IS NULL
  OR char_length(v_ref) NOT BETWEEN 6 AND 120 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BANK_CONFIRMATION_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM public.topup_requests old
  WHERE old.station_bank_id=t.station_bank_id AND old.status='approved'
   AND old.bank_reference=v_ref AND old.id<>t.id) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DUPLICATE_BANK_TRANSFER';END IF;
 SELECT coalesce(sum(ar.outstanding_satang),0)::bigint INTO v_all_debt
  FROM public.accounts_receivable ar WHERE ar.account_id=a.id;
 IF v_all_debt<>a.debt_outstanding_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DEBT_LEDGER_MISMATCH';END IF;
 v_remaining:=t.amount_satang;
 FOR v_ar IN
  SELECT * FROM public.accounts_receivable ar
  WHERE ar.account_id=a.id AND ar.outstanding_satang>0
  ORDER BY ar.due_at NULLS LAST,ar.created_at,ar.id FOR UPDATE
 LOOP
  EXIT WHEN v_remaining<=0;
  v_payable:=least(v_remaining,v_ar.outstanding_satang);
  UPDATE public.accounts_receivable SET
   outstanding_satang=outstanding_satang-v_payable WHERE id=v_ar.id;
  v_remaining:=v_remaining-v_payable;
  v_paid:=v_paid+v_payable;
 END LOOP;
 v_ledger_prepaid:=v_remaining;
 UPDATE public.corporate_station_accounts SET
  prepaid_balance_satang=prepaid_balance_satang+v_ledger_prepaid,
  debt_outstanding_satang=debt_outstanding_satang-v_paid
 WHERE id=a.id;
 UPDATE public.topup_requests SET status='approved',bank_reference=v_ref,
  reviewed_by=p_actor_id,reviewed_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_prepaid_satang,
  delta_debt_satang,reference_type,reference_id)
 VALUES(a.id,'topup_approved',v_ledger_prepaid,-v_paid,'topup',t.id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,a.station_id,'topup_request',t.id::text,'topup_approved',
  jsonb_build_object('amount_satang',t.amount_satang,
   'paid_debt_satang',v_paid,'added_prepaid_satang',v_remaining));
 RETURN jsonb_build_object('requestId',t.id,'status','approved','replayed',false,
  'paidDebtSatang',v_paid,'addedPrepaidSatang',v_remaining);
END $f$;

REVOKE ALL ON FUNCTION public.request_corporate_topup(uuid,uuid,uuid,bigint,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_corporate_topup(uuid,uuid,boolean,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_corporate_topup(uuid,uuid,uuid,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_corporate_topup(uuid,uuid,boolean,boolean,text) TO service_role;
