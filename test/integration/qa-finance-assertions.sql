-- All writes run in disposable CI PostgreSQL and roll back.
-- Confirms real SQL authorization and balance movements, not only JS mocks.
BEGIN;
DO $qa$
DECLARE
 names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 s_ids uuid[]:=ARRAY[]::uuid[];c_ids uuid[]:=ARRAY[]::uuid[];
 a_id uuid;v_owner uuid:=gen_random_uuid();v_corp uuid:=gen_random_uuid();
 v_other uuid:=gen_random_uuid();v_self uuid:=gen_random_uuid();
 v_station uuid;v_company uuid;v_org uuid;v_qa text:='QA-20261031-PLATFORM-001';
 v_response jsonb;v_request uuid;v_rejected uuid;v_replayed jsonb;
 v_failed boolean;v_i int;v_j int;v_accounts uuid[]:=ARRAY[]::uuid[];
 v_coupon uuid;v_total bigint;
BEGIN
 FOR v_i IN 1..4 LOOP
   v_org:=gen_random_uuid();v_station:=gen_random_uuid();
   INSERT INTO public.organizations(id,name) VALUES(v_org,'QA Organization '||v_i);
   INSERT INTO public.stations(id,organization_id,name)
    VALUES(v_station,v_org,names[v_i]);
   s_ids:=array_append(s_ids,v_station);
   FOR v_j IN 1..3 LOOP
     v_company:=gen_random_uuid();
     INSERT INTO public.corporate_companies(id,name) VALUES(
       v_company,names[v_i]||'-C0'||v_j::text);
     INSERT INTO public.corporate_station_accounts(station_id,company_id)
       VALUES(v_station,v_company) RETURNING id INTO a_id;
     c_ids:=array_append(c_ids,v_company);
     v_accounts:=array_append(v_accounts,a_id);
   END LOOP;
 END LOOP;

 FOR v_i IN 1..4 LOOP
   INSERT INTO auth.users(id,raw_app_meta_data) VALUES(
     (ARRAY[v_owner,v_corp,v_other,v_self])[v_i],
     pg_catalog.jsonb_build_object('oilstation_qa','true','oilstation_qa_run_id',v_qa));
   INSERT INTO public.app_users(id) VALUES((ARRAY[v_owner,v_corp,v_other,v_self])[v_i]);
 END LOOP;
 INSERT INTO public.memberships(user_id,role_code,scope_type,station_id)
 VALUES(v_owner,'station_owner','station',s_ids[1]),
       (v_other,'manager','station',s_ids[2]),
       (v_self,'cashier','station',s_ids[1]);
 INSERT INTO public.memberships(user_id,role_code,scope_type,corporate_company_id)
 VALUES(v_corp,'corporate_admin','corporate_company',c_ids[1]),
       (v_self,'corporate_admin','corporate_company',c_ids[1]);

 IF NOT has_function_privilege('service_role',
  'public.oilstation_qa_review_wallet_topup(uuid,text,uuid,boolean,uuid[],uuid[])','EXECUTE')
 THEN RAISE EXCEPTION 'worker cannot use QA review';END IF;
 IF has_function_privilege('anon',
  'public.oilstation_qa_review_wallet_topup(uuid,text,uuid,boolean,uuid[],uuid[])','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.oilstation_qa_request_wallet_topup(uuid,text,uuid,bigint,uuid,uuid[],uuid[])','EXECUTE')
 THEN RAISE EXCEPTION 'browser privileged QA rpc exposure';END IF;

 a_id:=v_accounts[1];
 v_response:=public.oilstation_qa_request_wallet_topup(
   v_corp,v_qa,a_id,15000,gen_random_uuid(),s_ids,c_ids);
 v_request:=(v_response->>'requestId')::uuid;
 IF v_response->>'status'<>'pending'
   OR (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a_id)<>0
   OR (SELECT count(*) FROM public.wallet_ledger WHERE account_id=a_id)<>0
 THEN RAISE EXCEPTION 'request credited before approval';END IF;
 IF jsonb_array_length(public.oilstation_qa_pending_wallet_topups(
   v_owner,v_qa,s_ids[1],s_ids,c_ids))<>1
 THEN RAISE EXCEPTION 'approval inbox not populated';END IF;

 -- Even if the requester is also temporarily granted a station review role,
 -- it may NEVER self-approve the financial topup.
 INSERT INTO public.memberships(user_id,role_code,scope_type,station_id)
 VALUES(v_corp,'cashier','station',s_ids[1]);
 v_failed:=false;
 BEGIN
   PERFORM public.oilstation_qa_review_wallet_topup(
     v_corp,v_qa,v_request,true,s_ids,c_ids);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'requester self approved topup';END IF;

 v_failed:=false;
 BEGIN
   PERFORM public.oilstation_qa_review_wallet_topup(
     v_other,v_qa,v_request,true,s_ids,c_ids);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'cross station reviewer approved';END IF;

 v_failed:=false;
 BEGIN
   PERFORM public.oilstation_qa_review_wallet_topup(
     v_self,v_qa,v_request,true,s_ids,c_ids);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 -- v_self is station member and corporate admin, but not request creator; legal
 -- distinct individual approval is permitted. This should not fail.
 IF v_failed THEN RAISE EXCEPTION 'different authorized reviewer unexpectedly blocked';END IF;
 -- After first approval, replay must never credit a second time.
 SELECT count(*) INTO v_total FROM public.wallet_ledger
   WHERE account_id=a_id AND entry_type='qa_topup_simulated';
 IF v_total<>1 THEN RAISE EXCEPTION 'expected exactly one approved ledger row';END IF;
 v_replayed:=public.oilstation_qa_review_wallet_topup(
   v_owner,v_qa,v_request,true,s_ids,c_ids);
 IF v_replayed->>'replayed'<>'true'
   OR (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a_id)<>15000
 THEN RAISE EXCEPTION 'approval replay double credited';END IF;

 -- Debt-first test on a second request: create 75 THB receivable.
 UPDATE public.corporate_station_accounts
 SET debt_outstanding_satang=7500 WHERE id=a_id;
 INSERT INTO public.accounts_receivable(account_id,amount_satang,outstanding_satang)
 VALUES(a_id,7500,7500);
 v_response:=public.oilstation_qa_request_wallet_topup(
   v_corp,v_qa,a_id,20000,gen_random_uuid(),s_ids,c_ids);
 v_request:=(v_response->>'requestId')::uuid;
 v_response:=public.oilstation_qa_review_wallet_topup(
   v_owner,v_qa,v_request,true,s_ids,c_ids);
 IF v_response->>'paidDebtSatang'<>'7500'
   OR v_response->>'addedPrepaidSatang'<>'12500'
   OR (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a_id)<>27500
   OR (SELECT debt_outstanding_satang FROM public.corporate_station_accounts WHERE id=a_id)<>0
   OR (SELECT sum(outstanding_satang) FROM public.accounts_receivable WHERE account_id=a_id)<>0
 THEN RAISE EXCEPTION 'QA approval debt-first incorrect %',v_response;END IF;
 IF (SELECT count(*) FROM public.wallet_ledger WHERE account_id=a_id AND entry_type='qa_topup_simulated')<>2
 THEN RAISE EXCEPTION 'wallet ledger missing/duplicated';END IF;

 -- Rejection adds no money and cannot be silently approved on retry.
 v_response:=public.oilstation_qa_request_wallet_topup(
   v_corp,v_qa,a_id,10000,gen_random_uuid(),s_ids,c_ids);
 v_rejected:=(v_response->>'requestId')::uuid;
 v_response:=public.oilstation_qa_review_wallet_topup(
   v_owner,v_qa,v_rejected,false,s_ids,c_ids);
 IF v_response->>'status'<>'rejected' THEN RAISE EXCEPTION 'rejection failed';END IF;
 v_response:=public.oilstation_qa_review_wallet_topup(
   v_owner,v_qa,v_rejected,true,s_ids,c_ids);
 IF v_response->>'status'<>'rejected'
 OR (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a_id)<>27500
 THEN RAISE EXCEPTION 'rejected topup was revived';END IF;

 v_failed:=false;
 BEGIN
   PERFORM public.oilstation_qa_request_wallet_topup(
     v_corp,v_qa,v_accounts[4],10000,gen_random_uuid(),s_ids,c_ids);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'company member funded wrong station';END IF;

 -- The shared-driver link must resolve QA coupons only.
 INSERT INTO public.coupons(account_id,station_id,max_amount_satang,secret_link_hash,expires_at)
 VALUES(a_id,s_ids[1],12000,repeat('a',64),clock_timestamp()+interval '1 day')
 RETURNING id INTO v_coupon;
 IF public.oilstation_qa_coupon_link_scope(v_coupon,s_ids,c_ids) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'QA signed link scope denies valid coupon';END IF;
 IF public.oilstation_qa_coupon_link_scope(v_coupon,
     ARRAY[s_ids[2],s_ids[1],s_ids[3],s_ids[4]],c_ids) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'reordered station list bypassed QA allowlist';END IF;

 IF (SELECT count(*) FROM public.topup_requests)<>0 THEN
  RAISE EXCEPTION 'synthetic QA topup altered real bank topup ledger';END IF;
 IF (SELECT count(*) FROM public.audit_events WHERE entity_type='qa_topup_simulation')<>6
 THEN RAISE EXCEPTION 'audit event count mismatch';END IF;
 RAISE NOTICE 'QA simulated topup SQL UAT PASS: approvals, replay, debt-first, rejection, scope, audit';
END $qa$;
ROLLBACK;
