-- Synthetic QA wallet topups. NO bank transfer, payment, slip, or real deposit.
-- Strictly 12 approved QA companies / 4 QA stations / frozen run ID.
-- Values are posted to QA-only account balances to exercise real QR/reservation/settlement.
CREATE TABLE IF NOT EXISTS public.qa_topup_simulations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key uuid NOT NULL UNIQUE,
 qa_run_id text NOT NULL CHECK (qa_run_id='QA-20261031-PLATFORM-001'),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 amount_satang bigint NOT NULL CHECK (amount_satang BETWEEN 100 AND 5000000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 requested_by uuid NOT NULL REFERENCES public.app_users(id),
 reviewed_by uuid REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reviewed_at timestamptz,
 CONSTRAINT qa_sim_review_consistency CHECK (
   (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
   OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
 ),
 CONSTRAINT qa_sim_no_self_approval CHECK (requested_by IS DISTINCT FROM reviewed_by)
);
CREATE INDEX IF NOT EXISTS qa_topup_station_pending_idx
 ON public.qa_topup_simulations(station_id,created_at) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS qa_topup_one_pending_account
 ON public.qa_topup_simulations(account_id) WHERE status='pending';
ALTER TABLE public.qa_topup_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_topup_simulations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.qa_topup_simulations FROM PUBLIC,anon,authenticated,service_role;

-- Validate every configured UUID against the actual fixed QA station/company
-- name and account associations. Reject a forged or reordered allowlist.
CREATE OR REPLACE FUNCTION public.oilstation_qa_wallet_scope(
 p_actor_id uuid,p_qa_run_id text,p_account_id uuid,
 p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_i integer;v_si integer;v_slot integer;
 v_account public.corporate_station_accounts%ROWTYPE;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
   OR cardinality(p_station_ids) IS DISTINCT FROM 4
   OR cardinality(p_company_ids) IS DISTINCT FROM 12
   OR p_actor_id IS NULL OR p_account_id IS NULL
   OR NOT EXISTS(SELECT 1 FROM auth.users u
     WHERE u.id=p_actor_id AND u.raw_app_meta_data->>'oilstation_qa'='true'
      AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 FOR v_i IN 1..4 LOOP
   IF NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_ids[v_i]
     AND s.name=v_names[v_i])
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 END LOOP;
 FOR v_i IN 1..12 LOOP
   v_si:=((v_i-1)/3)+1;
   v_slot:=((v_i-1)%3)+1;
   IF NOT EXISTS (
    SELECT 1 FROM public.corporate_companies c
      JOIN public.corporate_station_accounts a ON a.company_id=c.id
    WHERE c.id=p_company_ids[v_i] AND a.station_id=p_station_ids[v_si]
      AND c.name=v_names[v_si]||'-C0'||v_slot::text
   ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 END LOOP;
 SELECT * INTO v_account FROM public.corporate_station_accounts
  WHERE id=p_account_id AND station_id=ANY(p_station_ids)
    AND company_id=ANY(p_company_ids);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN pg_catalog.jsonb_build_object('stationId',v_account.station_id,
   'companyId',v_account.company_id,'accountId',v_account.id);
END $fn$;

-- Corporate accounting role requests synthetic topup; balance remains unchanged.
CREATE OR REPLACE FUNCTION public.oilstation_qa_request_wallet_topup(
 p_actor_id uuid,p_qa_run_id text,p_account_id uuid,p_amount_satang bigint,
 p_request_key uuid,p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_scope jsonb;v_row public.qa_topup_simulations%ROWTYPE;
 v_station uuid;v_company uuid;
BEGIN
 v_scope:=public.oilstation_qa_wallet_scope(p_actor_id,p_qa_run_id,p_account_id,
   p_station_ids,p_company_ids);
 v_station:=(v_scope->>'stationId')::uuid;
 v_company:=(v_scope->>'companyId')::uuid;
 IF p_amount_satang IS NULL OR p_amount_satang NOT BETWEEN 100 AND 5000000
    OR p_request_key IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
   AND m.user_id=p_actor_id AND m.scope_type='corporate_company'
   AND m.corporate_company_id=v_company
   AND m.role_code IN ('corporate_admin','accountant','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('qa_topup:'||p_account_id::text,0));
 SELECT * INTO v_row FROM public.qa_topup_simulations WHERE request_key=p_request_key;
 IF FOUND THEN
   IF v_row.account_id<>p_account_id OR v_row.requested_by<>p_actor_id
      OR v_row.amount_satang<>p_amount_satang OR v_row.qa_run_id<>p_qa_run_id
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
   RETURN pg_catalog.jsonb_build_object('requestId',v_row.id,
     'status',v_row.status,'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.qa_topup_simulations t
    WHERE t.account_id=p_account_id AND t.status='pending')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PENDING_EXISTS';END IF;
 INSERT INTO public.qa_topup_simulations(request_key,qa_run_id,station_id,
   account_id,amount_satang,requested_by)
 VALUES(p_request_key,p_qa_run_id,v_station,p_account_id,p_amount_satang,p_actor_id)
 RETURNING * INTO v_row;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,v_station,'qa_topup_simulation',v_row.id::text,'qa_topup_requested',
  pg_catalog.jsonb_build_object('qaRunId',p_qa_run_id,'simulated',true,
    'amountSatang',p_amount_satang));
 RETURN pg_catalog.jsonb_build_object('requestId',v_row.id,'status','pending',
   'replayed',false,'simulated',true);
END $fn$;

-- Only a different QA station owner/manager/cashier/finance manager may approve.
-- Rejection is no-op financially. Approval posts debt-first + immutable wallet
-- ledger, never changes a real-bank reference or topup_requests.
CREATE OR REPLACE FUNCTION public.oilstation_qa_review_wallet_topup(
 p_actor_id uuid,p_qa_run_id text,p_request_id uuid,p_approved boolean,
 p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.qa_topup_simulations%ROWTYPE;
 a public.corporate_station_accounts%ROWTYPE;v_scope jsonb;
 v_remaining bigint;v_paid bigint:=0;v_total bigint;v_payable bigint;
 v_ar public.accounts_receivable%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_approved IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO t FROM public.qa_topup_simulations WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_scope:=public.oilstation_qa_wallet_scope(p_actor_id,p_qa_run_id,t.account_id,
   p_station_ids,p_company_ids);
 IF t.station_id<>(v_scope->>'stationId')::uuid OR t.qa_run_id<>p_qa_run_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF t.requested_by=p_actor_id OR NOT EXISTS(
   SELECT 1 FROM public.memberships m WHERE m.active
     AND m.user_id=p_actor_id AND m.scope_type='station'
     AND m.station_id=t.station_id
     AND m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF t.status<>'pending' THEN RETURN pg_catalog.jsonb_build_object('requestId',t.id,
     'status',t.status,'replayed',true,'simulated',true); END IF;
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=t.account_id FOR UPDATE;
 IF NOT FOUND OR a.station_id<>t.station_id THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT p_approved THEN
   UPDATE public.qa_topup_simulations SET status='rejected',
      reviewed_by=p_actor_id,reviewed_at=clock_timestamp() WHERE id=t.id;
   INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
   VALUES(p_actor_id,t.station_id,'qa_topup_simulation',t.id::text,'qa_topup_rejected',
     pg_catalog.jsonb_build_object('qaRunId',p_qa_run_id,'simulated',true));
   RETURN pg_catalog.jsonb_build_object('requestId',t.id,
     'status','rejected','replayed',false,'simulated',true);
 END IF;
 SELECT coalesce(sum(z.amount_satang),0)::bigint INTO v_total
  FROM public.qa_topup_simulations z WHERE z.account_id=t.account_id AND z.status='approved';
 IF v_total+t.amount_satang>10000000 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_TOPUP_LIMIT_REACHED';END IF;
 SELECT coalesce(sum(ar.outstanding_satang),0)::bigint INTO v_total
  FROM public.accounts_receivable ar WHERE ar.account_id=a.id;
 IF v_total<>a.debt_outstanding_satang THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DEBT_LEDGER_MISMATCH';END IF;
 v_remaining:=t.amount_satang;
 FOR v_ar IN SELECT * FROM public.accounts_receivable ar
    WHERE ar.account_id=a.id AND ar.outstanding_satang>0
    ORDER BY ar.due_at NULLS LAST,ar.created_at,ar.id FOR UPDATE
 LOOP
   EXIT WHEN v_remaining<=0;
   v_payable:=least(v_remaining,v_ar.outstanding_satang);
   UPDATE public.accounts_receivable SET outstanding_satang=outstanding_satang-v_payable
     WHERE id=v_ar.id;
   v_remaining:=v_remaining-v_payable;v_paid:=v_paid+v_payable;
 END LOOP;
 UPDATE public.corporate_station_accounts SET
   prepaid_balance_satang=prepaid_balance_satang+v_remaining,
   debt_outstanding_satang=debt_outstanding_satang-v_paid WHERE id=a.id;
 UPDATE public.qa_topup_simulations SET status='approved',
   reviewed_by=p_actor_id,reviewed_at=clock_timestamp() WHERE id=t.id;
 INSERT INTO public.wallet_ledger(account_id,entry_type,delta_prepaid_satang,
   delta_debt_satang,reference_type,reference_id)
 VALUES(a.id,'qa_topup_simulated',v_remaining,-v_paid,'qa_topup',t.id);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,t.station_id,'qa_topup_simulation',t.id::text,'qa_topup_simulated_approved',
  pg_catalog.jsonb_build_object('qaRunId',p_qa_run_id,'simulated',true,
    'bankReceived',false,'amountSatang',t.amount_satang,
    'paidDebtSatang',v_paid,'addedPrepaidSatang',v_remaining));
 RETURN pg_catalog.jsonb_build_object('requestId',t.id,'status','approved',
   'replayed',false,'simulated',true,'paidDebtSatang',v_paid,
   'addedPrepaidSatang',v_remaining);
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_qa_pending_wallet_topups(
 p_actor_id uuid,p_qa_run_id text,p_station_id uuid,
 p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a public.corporate_station_accounts%ROWTYPE;v_result jsonb;
BEGIN
 SELECT * INTO a FROM public.corporate_station_accounts
   WHERE station_id=p_station_id AND company_id=ANY(p_company_ids) LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 PERFORM public.oilstation_qa_wallet_scope(p_actor_id,p_qa_run_id,a.id,
    p_station_ids,p_company_ids);
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
   AND m.user_id=p_actor_id AND m.scope_type='station' AND m.station_id=p_station_id
   AND m.role_code IN ('station_owner','owner','manager','cashier','finance_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(
  pg_catalog.jsonb_build_object('requestId',v.id,'companyName',v.name,
    'amountSatang',v.amount_satang::text,'requestedAt',v.created_at,
    'status',v.status,'simulated',true)
  ORDER BY v.created_at),'[]'::jsonb) INTO v_result
 FROM (
   SELECT t.id,c.name,t.amount_satang,t.created_at,t.status
   FROM public.qa_topup_simulations t
    JOIN public.corporate_station_accounts ca ON ca.id=t.account_id
    JOIN public.corporate_companies c ON c.id=ca.company_id
   WHERE t.station_id=p_station_id AND t.qa_run_id=p_qa_run_id
     AND t.status='pending' AND ca.company_id=ANY(p_company_ids)
   ORDER BY t.created_at LIMIT 30
 ) v;
 RETURN v_result;
END $fn$;

REVOKE ALL ON FUNCTION public.oilstation_qa_wallet_scope(uuid,text,uuid,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_qa_request_wallet_topup(uuid,text,uuid,bigint,uuid,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_qa_review_wallet_topup(uuid,text,uuid,boolean,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_qa_pending_wallet_topups(uuid,text,uuid,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_wallet_scope(uuid,text,uuid,uuid[],uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_request_wallet_topup(uuid,text,uuid,bigint,uuid,uuid[],uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_review_wallet_topup(uuid,text,uuid,boolean,uuid[],uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_pending_wallet_topups(uuid,text,uuid,uuid[],uuid[]) TO service_role;
