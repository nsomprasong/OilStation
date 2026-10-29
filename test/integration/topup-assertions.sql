-- Test data is fictional and completely isolated from live Supabase.
BEGIN;
DO $assert$
DECLARE
 issuer uuid:='11111111-1111-4111-8111-111111111111';
 attendant uuid:='22222222-2222-4222-8222-222222222222';
 reviewer uuid:='33333333-3333-4333-8333-333333333333';
 foreign_reviewer uuid:='44444444-4444-4444-8444-444444444444';
 outsider uuid:='55555555-5555-4555-8555-555555555555';
 account_a uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 account_b uuid:='bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb';
 bank_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-555555555555';
 bank_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-555555555555';
 station_a uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 req_id uuid;second_id uuid;v_path text;response jsonb;
 before_money record;after_money record;
 v_failed boolean;
BEGIN
 IF has_function_privilege('service_role',
   'public.review_corporate_topup(uuid,uuid,boolean,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'unreviewed_wallet_credit_open_to_worker';END IF;
 IF NOT has_function_privilege('service_role',
   'public.review_verified_corporate_topup(uuid,uuid,boolean,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'safe_bank_review_wrapper_not_callable';END IF;
 IF has_function_privilege('anon',
   'public.review_verified_corporate_topup(uuid,uuid,boolean,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'unauthenticated_bank_review';END IF;

 -- Simulate an existing 75-baht receivable, with wallet debt matching AR.
 UPDATE public.corporate_station_accounts SET debt_outstanding_satang=7500
 WHERE id=account_a;
 INSERT INTO public.accounts_receivable(account_id,amount_satang,
   outstanding_satang,due_at)
 VALUES(account_a,7500,7500,clock_timestamp()+interval '7 days');
 SELECT prepaid_balance_satang,debt_outstanding_satang,reserved_satang
 INTO before_money FROM public.corporate_station_accounts WHERE id=account_a;

 v_failed:=false;
 BEGIN
  PERFORM public.authorize_corporate_topup_upload(
    outsider,account_a,bank_a,15000);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_corporate_authorized_upload';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.authorize_corporate_topup_upload(
    issuer,account_a,bank_b,15000);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='INVALID_BANK_ACCOUNT';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'cross_station_bank_selected';END IF;

 v_path:='accounts/'||account_a::text||'/slips/'||
   'aaaaaaaa-aaaa-4aaa-8aaa-111111111111.jpg';
 v_failed:=false;
 BEGIN
  PERFORM public.request_corporate_topup(
   issuer,account_a,bank_a,15000,v_path);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='INVALID_EVIDENCE';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'topup_without_private_slip_object';END IF;

 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-slips',v_path);
 response:=public.request_corporate_topup(issuer,account_a,bank_a,15000,v_path);
 req_id:=(response->>'requestId')::uuid;
 IF response->>'status'<>'pending' OR response->>'verified'<>'false'
   OR response->>'addedPrepaidSatang'<>'0'
 THEN RAISE EXCEPTION 'slip_upload_inappropriately_credited_wallet %',response;END IF;
 SELECT prepaid_balance_satang,debt_outstanding_satang,reserved_satang
 INTO after_money FROM public.corporate_station_accounts WHERE id=account_a;
 IF before_money IS DISTINCT FROM after_money THEN
   RAISE EXCEPTION 'slip_intake_changed_wallet_before_review';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.station_pending_topup_inbox(foreign_reviewer,station_a);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_station_see_bank_slips';END IF;
 IF jsonb_array_length(public.station_pending_topup_inbox(reviewer,station_a))<>1
 THEN RAISE EXCEPTION 'authorized_station_inbox_missing';END IF;
 IF jsonb_array_length(public.corporate_topup_bank_options(issuer,account_a))<>1
 THEN RAISE EXCEPTION 'corporate_bank_options_not_scoped';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.review_verified_corporate_topup(
    foreign_reviewer,req_id,true,true,'BANK-REF-000123');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_station_approved_topup';END IF;

 -- Deliberately give issuer a station-owner role. Dual membership must
 -- NEVER allow the same person to request and approve their own topup.
 INSERT INTO public.memberships(user_id,scope_type,role_code,station_id)
 VALUES(issuer,'station','manager',station_a);
 v_failed:=false;
 BEGIN
  PERFORM public.review_verified_corporate_topup(
    issuer,req_id,true,true,'BANK-REF-000123');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='SELF_APPROVAL_FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'issuer_with_dual_role_self_approved';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.review_verified_corporate_topup(
    reviewer,req_id,true,false,'BANK-REF-000123');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='BANK_CONFIRMATION_REQUIRED';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'topup_without_bank_confirmation';END IF;

 response:=public.review_verified_corporate_topup(
   reviewer,req_id,true,true,'bank-ref-000123');
 IF response->>'status'<>'approved' OR response->>'replayed'<>'false'
   OR response->>'paidDebtSatang'<>'7500'
   OR response->>'addedPrepaidSatang'<>'7500'
 THEN RAISE EXCEPTION 'debt_first_topup_wrong %',response;END IF;
 IF (SELECT prepaid_balance_satang FROM public.corporate_station_accounts
   WHERE id=account_a)<>17500
   OR (SELECT debt_outstanding_satang FROM public.corporate_station_accounts
   WHERE id=account_a)<>0
   OR (SELECT outstanding_satang FROM public.accounts_receivable
   WHERE account_id=account_a)<>0
 THEN RAISE EXCEPTION 'bank_approval_wallet_debt_mismatch';END IF;
 response:=public.review_verified_corporate_topup(
   reviewer,req_id,true,true,'bank-ref-000123');
 IF response->>'replayed'<>'true' OR
   (SELECT count(*) FROM public.wallet_ledger WHERE entry_type='topup_approved')<>1
 THEN RAISE EXCEPTION 'duplicate_topup_review_credited_twice';END IF;

 -- A second slip may be genuine but cannot reuse an already settled
 -- bank reference; enforce idempotency by bank account + reference.
 v_path:='accounts/'||account_a::text||'/slips/'||
  'aaaaaaaa-aaaa-4aaa-8aaa-222222222222.jpg';
 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-slips',v_path);
 response:=public.request_corporate_topup(
  issuer,account_a,bank_a,12000,v_path);
 second_id:=(response->>'requestId')::uuid;
 v_failed:=false;
 BEGIN
  PERFORM public.review_verified_corporate_topup(
   reviewer,second_id,true,true,'BANK-REF-000123');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='DUPLICATE_BANK_TRANSFER';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'same_bank_transfer_approved_twice';END IF;
 IF (SELECT status FROM public.topup_requests WHERE id=second_id)<>'pending'
   OR (SELECT prepaid_balance_satang FROM public.corporate_station_accounts
   WHERE id=account_a)<>17500
 THEN RAISE EXCEPTION 'failed_duplicate_bank_reference_mutated_wallet';END IF;

 -- Denial creates no credit; it cannot be upgraded through repeated reviews.
 response:=public.review_verified_corporate_topup(
  reviewer,second_id,false,false,NULL);
 IF response->>'status'<>'rejected' THEN
  RAISE EXCEPTION 'rejection_not_saved';END IF;
 response:=public.review_verified_corporate_topup(
  reviewer,second_id,false,false,NULL);
 IF response->>'replayed'<>'true' OR
  (SELECT count(*) FROM public.wallet_ledger WHERE entry_type='topup_approved')<>1
 THEN RAISE EXCEPTION 'replayed_rejection_changed_wallet';END IF;
END $assert$;
ROLLBACK;
