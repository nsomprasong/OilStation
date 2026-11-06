-- Must be wrapped in BEGIN ... ROLLBACK (no real funds or bank accounts).
DO $qa$
DECLARE
 v_account public.corporate_station_accounts%ROWTYPE;
 v_corporate uuid;v_owner uuid;v_bank uuid;
 v jsonb;v_out bigint;v_req uuid;v_slip text;v_fail boolean;
BEGIN
 SELECT * INTO v_account FROM public.corporate_station_accounts a
 WHERE EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.active AND m.scope_type='station' AND m.station_id=a.station_id
   AND m.role_code IN ('station_owner','owner','manager'))
  AND EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.active AND m.scope_type='corporate_company'
    AND m.corporate_company_id=a.company_id
    AND m.role_code IN ('corporate_admin','accountant','finance_manager'))
 ORDER BY a.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'qa_no_corporate_account';END IF;
 SELECT user_id INTO v_owner FROM public.memberships WHERE station_id=v_account.station_id
 AND active AND role_code IN ('station_owner','owner','manager') ORDER BY user_id LIMIT 1;
 SELECT user_id INTO v_corporate FROM public.memberships WHERE corporate_company_id=v_account.company_id
 AND active AND role_code IN ('corporate_admin','accountant','finance_manager') ORDER BY user_id LIMIT 1;
 IF v_owner IS NULL OR v_corporate IS NULL THEN RAISE EXCEPTION 'qa_roles_missing';END IF;
 v:=public.station_set_topup_amount_options(v_owner,v_account.station_id,
  ARRAY[50000,150000,300000]::bigint[]);
 IF v->>'saved'<>'true' THEN RAISE EXCEPTION 'qa_station_amount_save_failed'; END IF;
 v:=public.corporate_topup_amount_options(v_corporate,v_account.id);
 IF jsonb_array_length(v)<>3 OR NOT v ? '150000'
 THEN RAISE EXCEPTION 'qa_corporate_amount_options_wrong';END IF;
 v:=public.station_register_topup_bank(v_owner,v_account.station_id,'PROMPTPAY',
  'QA Synthetic PromptPay','aes256gcm:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  '••••5678',true);
 v_bank:=(v->>'id')::uuid;
 SELECT prepaid_balance_satang INTO v_out FROM public.corporate_station_accounts WHERE id=v_account.id;
 v_fail:=false;
 BEGIN
  PERFORM public.authorize_corporate_topup_preset_upload(v_corporate,v_account.id,v_bank,99900);
 EXCEPTION WHEN OTHERS THEN v_fail:=SQLERRM='INVALID_REQUEST';END;
 IF NOT v_fail THEN RAISE EXCEPTION 'qa_arbitrary_amount_accepted';END IF;
 PERFORM public.authorize_corporate_topup_preset_upload(v_corporate,v_account.id,v_bank,150000);
 v_slip:='accounts/'||v_account.id::text||'/slips/'||gen_random_uuid()::text||'.png';
 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-slips',v_slip);
 v_fail:=false;
 BEGIN
  PERFORM public.request_corporate_topup(v_corporate,v_account.id,v_bank,99900,v_slip);
 EXCEPTION WHEN OTHERS THEN v_fail:=SQLERRM='INVALID_REQUEST';END;
 IF NOT v_fail THEN RAISE EXCEPTION 'qa_legacy_rpc_bypassed_amount_guard';END IF;
 v:=public.request_corporate_topup(v_corporate,v_account.id,v_bank,150000,v_slip);
 v_req:=(v->>'requestId')::uuid;
 IF v->>'status'<>'pending' OR
   (SELECT prepaid_balance_satang FROM public.corporate_station_accounts WHERE id=v_account.id)<>v_out
 THEN RAISE EXCEPTION 'qa_unapproved_topup_changed_wallet';END IF;
 RAISE NOTICE 'PASS: fixed amounts, PromptPay station receiver, deny altered amount, no credit before station approval';
END $qa$;
