-- Disposable PostgreSQL only; never connect this fixture to production.
BEGIN;
DO $qa$
DECLARE owner_id uuid:='33333333-3333-4333-8333-333333333333';
 attendant_id uuid:='22222222-2222-4222-8222-222222222222';
 corporate_id uuid:='11111111-1111-4111-8111-111111111111';
 foreign_id uuid:='55555555-5555-4555-8555-555555555555';
 station_id uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 account_id uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 registered jsonb;readback jsonb;id uuid;failed boolean;
BEGIN
 failed:=false;
 BEGIN
  PERFORM public.station_register_topup_bank(attendant_id,station_id,'KBANK',
    'Mock Receiver','aes256gcm:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '••••1234',false);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='FORBIDDEN';END;
 IF NOT failed THEN RAISE EXCEPTION 'unauthorized_attendant_can_register_bank';END IF;
 registered:=public.station_register_topup_bank(owner_id,station_id,'KBANK',
  'Mock Receiver','aes256gcm:v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  '••••1234',true);
 id:=(registered->>'id')::uuid;
 IF id IS NULL THEN RAISE EXCEPTION 'bank_not_registered';END IF;
 readback:=public.station_topup_bank_profiles(owner_id,station_id);
 IF jsonb_array_length(readback)<1 OR readback::text LIKE '%aes256gcm%'
 THEN RAISE EXCEPTION 'profiles_missing_or_ciphertext_leaked';END IF;
 readback:=public.corporate_topup_bank_transfer_details(corporate_id,account_id,id);
 IF readback->>'encryptedNumber' NOT LIKE 'aes256gcm:v1:%'
 THEN RAISE EXCEPTION 'encrypted_bank_not_scoped_to_corporate';END IF;
 failed:=false;
 BEGIN
  PERFORM public.corporate_topup_bank_transfer_details(foreign_id,account_id,id);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='FORBIDDEN';END;
 IF NOT failed THEN RAISE EXCEPTION 'cross_company_bank_details_leak';END IF;
 failed:=false;
 BEGIN
  PERFORM public.corporate_topup_bank_transfer_details(corporate_id,
   'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',id);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM IN ('FORBIDDEN','NOT_FOUND');END;
 IF NOT failed THEN RAISE EXCEPTION 'cross_station_bank_not_rejected';END IF;
 IF has_function_privilege('anon',
  'public.station_register_topup_bank(uuid,uuid,text,text,text,text,boolean)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.corporate_topup_bank_transfer_details(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'bank_rpc_public_grant';END IF;
END $qa$;
ROLLBACK;
