-- Run only in BEGIN ... ROLLBACK on the live-shaped QA database.
-- All bank numbers and references below are synthetic; no bank transfer occurs.
DO $qa$
DECLARE a public.corporate_station_accounts%ROWTYPE;
 customer_id uuid;owner_id uuid;outsider_id uuid;
 bank_id uuid;other_station_bank uuid;request_id uuid;
 ref text:='QA-ROLLBACK-20261106-00001';
 slip text;result jsonb;prepaid_before bigint;ledger_before bigint;
BEGIN
 SELECT * INTO a FROM public.corporate_station_accounts ca
 WHERE ca.debt_outstanding_satang=0 AND
 EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.active AND m.scope_type='corporate_company' AND m.corporate_company_id=ca.company_id
   AND m.role_code IN ('corporate_admin','accountant','finance_manager'))
 AND EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.active AND m.scope_type='station' AND m.station_id=ca.station_id
   AND m.role_code IN ('station_owner','owner','manager'))
 ORDER BY ca.id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'qa_no_eligible_corporate_account';END IF;
 SELECT user_id INTO customer_id FROM public.memberships m WHERE m.active
  AND m.scope_type='corporate_company' AND m.corporate_company_id=a.company_id
  AND m.role_code IN ('corporate_admin','accountant','finance_manager')
 ORDER BY user_id LIMIT 1;
 SELECT user_id INTO owner_id FROM public.memberships m WHERE m.active
  AND m.scope_type='station' AND m.station_id=a.station_id
  AND m.role_code IN ('station_owner','owner','manager') AND m.user_id<>customer_id
 ORDER BY user_id LIMIT 1;
 IF customer_id IS NULL OR owner_id IS NULL THEN RAISE EXCEPTION 'qa_reviewers_missing';END IF;
 prepaid_before:=a.prepaid_balance_satang;
 SELECT count(*) INTO ledger_before FROM public.wallet_ledger
 WHERE account_id=a.id AND entry_type='topup_approved';
 result:=public.station_register_topup_bank(owner_id,a.station_id,'QA_BANK','QA Synthetic Receiver',
  'aes256gcm:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  '••••1234',true);
 bank_id:=(result->>'id')::uuid;
 IF bank_id IS NULL THEN RAISE EXCEPTION 'qa_bank_not_registered';END IF;
 IF (SELECT count(*) FROM public.station_topup_bank_profiles(owner_id,a.station_id) x) IS NULL
 THEN RAISE EXCEPTION 'qa_station_profile_missing';END IF;
 result:=public.corporate_topup_bank_transfer_details(customer_id,a.id,bank_id);
 IF result->>'encryptedNumber' NOT LIKE 'aes256gcm:v1:%'
 THEN RAISE EXCEPTION 'qa_bank_ciphertext_unavailable';END IF;
 -- Another corporate user cannot read a receiver for an unrelated corporate account.
 SELECT m.user_id INTO outsider_id FROM public.memberships m
 WHERE m.scope_type='corporate_company' AND m.active AND m.corporate_company_id<>a.company_id
 ORDER BY m.user_id LIMIT 1;
 IF outsider_id IS NOT NULL THEN
  BEGIN
   PERFORM public.corporate_topup_bank_transfer_details(outsider_id,a.id,bank_id);
   RAISE EXCEPTION 'qa_cross_company_bank_access_allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
   IF SQLERRM<>'FORBIDDEN' THEN RAISE;END IF;
  END;
 END IF;
 slip:='accounts/'||a.id::text||'/slips/'||gen_random_uuid()::text||'.jpg';
 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-slips',slip);
 result:=public.request_corporate_topup(customer_id,a.id,bank_id,12345,slip);
 request_id:=(result->>'requestId')::uuid;
 IF result->>'status'<>'pending' THEN RAISE EXCEPTION 'qa_topup_not_pending';END IF;
 IF (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a.id)<>prepaid_before
 THEN RAISE EXCEPTION 'qa_credit_increased_before_approval';END IF;
 BEGIN
  PERFORM public.review_verified_corporate_topup(owner_id,request_id,true,false,ref);
  RAISE EXCEPTION 'qa_approved_without_received_money';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM<>'BANK_CONFIRMATION_REQUIRED' THEN RAISE;END IF;
 END;
 result:=public.review_verified_corporate_topup(owner_id,request_id,true,true,ref);
 IF result->>'status'<>'approved' OR result->>'addedPrepaidSatang'<>'12345'
 THEN RAISE EXCEPTION 'qa_approval_failed %',result;END IF;
 IF (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=a.id)<>prepaid_before+12345
 THEN RAISE EXCEPTION 'qa_wallet_balance_incorrect';END IF;
 result:=public.review_verified_corporate_topup(owner_id,request_id,true,true,ref);
 IF result->>'replayed'<>'true' OR
  (SELECT count(*) FROM public.wallet_ledger
   WHERE account_id=a.id AND entry_type='topup_approved')<>ledger_before+1
 THEN RAISE EXCEPTION 'qa_replay_double_credited';END IF;
 RAISE NOTICE 'PASS: encrypted bank setup, scoped corporate lookup, upload, bank review, wallet credit and replay';
END $qa$;
