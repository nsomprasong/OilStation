-- Restricted bank-receiver provisioning and station/corporate scoped read.
-- Worker encrypts full account numbers under an unrecoverable-to-browser AES-GCM key.
-- No SQL routine decrypts them, and raw account numbers never enter audit logs.
CREATE OR REPLACE FUNCTION public.station_register_topup_bank(
 p_actor_id uuid,p_station_id uuid,p_bank_code text,p_account_name text,
 p_encrypted_number text,p_masked_number text,p_primary boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_id uuid;v_primary boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
    AND m.station_id=p_station_id
    AND (m.role_code IN ('station_owner','owner','manager')
     OR m.extra_permissions->>'manage_bank_accounts'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_id)
   OR p_bank_code IS NULL OR p_bank_code !~ '^[A-Z0-9_-]{2,20}$'
   OR p_account_name IS NULL OR char_length(btrim(p_account_name)) NOT BETWEEN 2 AND 120
   OR p_encrypted_number IS NULL OR p_encrypted_number !~
    '^aes256gcm:v1:[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{24,80}={0,2}$'
   OR p_masked_number IS NULL OR p_masked_number !~ '^••••[0-9]{4}$'
   OR p_primary IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Serializes concurrent bank profile and primary choices.
 PERFORM 1 FROM public.stations s WHERE s.id=p_station_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.station_bank_accounts b
  WHERE b.station_id=p_station_id AND b.account_number_encrypted=p_encrypted_number)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_primary:=p_primary OR NOT EXISTS(SELECT 1 FROM public.station_bank_accounts b
   WHERE b.station_id=p_station_id AND b.active);
 IF v_primary THEN
  UPDATE public.station_bank_accounts b SET is_primary=false
   WHERE b.station_id=p_station_id AND b.active AND b.is_primary;
 END IF;
 INSERT INTO public.station_bank_accounts(station_id,bank_code,account_name,
  account_number_encrypted,account_number_masked,is_primary,active)
 VALUES(p_station_id,p_bank_code,btrim(p_account_name),p_encrypted_number,
  p_masked_number,v_primary,true)
 RETURNING id INTO v_id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'station_bank_account',v_id::text,
  'bank_receiver_registered',jsonb_build_object('bankCode',p_bank_code,
   'maskedNumber',p_masked_number,'isPrimary',v_primary));
 RETURN jsonb_build_object('id',v_id,'bankCode',p_bank_code,'accountName',btrim(p_account_name),
  'accountNumberMasked',p_masked_number,'isPrimary',v_primary,'active',true);
END $fn$;

CREATE OR REPLACE FUNCTION public.station_topup_bank_profiles(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_out jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='station' AND m.station_id=p_station_id
  AND (m.role_code IN ('station_owner','owner','manager')
    OR m.extra_permissions->>'manage_bank_accounts'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'bankCode',b.bank_code,
  'accountName',b.account_name,'accountNumberMasked',b.account_number_masked,
  'active',b.active,'isPrimary',b.is_primary)
  ORDER BY b.is_primary DESC,b.created_at DESC),'[]'::jsonb)
 INTO v_out FROM public.station_bank_accounts b WHERE b.station_id=p_station_id;
 RETURN v_out;
END $fn$;

CREATE OR REPLACE FUNCTION public.corporate_topup_bank_transfer_details(
 p_actor_id uuid,p_account_id uuid,p_bank_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a public.corporate_station_accounts%ROWTYPE;
 b public.station_bank_accounts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
   AND m.corporate_company_id=a.company_id AND
   (m.role_code IN ('corporate_admin','accountant','finance_manager')
    OR m.extra_permissions->>'request_topup'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO b FROM public.station_bank_accounts
  WHERE id=p_bank_id AND station_id=a.station_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 -- The ciphertext is returned ONLY to trusted Worker service role,
 -- which decrypts it before returning scoped banking details to the client.
 RETURN jsonb_build_object('id',b.id,'bankCode',b.bank_code,
  'accountName',b.account_name,'encryptedNumber',b.account_number_encrypted);
END $fn$;

REVOKE ALL ON FUNCTION public.station_register_topup_bank(uuid,uuid,text,text,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_topup_bank_profiles(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.corporate_topup_bank_transfer_details(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_register_topup_bank(uuid,uuid,text,text,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_topup_bank_profiles(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.corporate_topup_bank_transfer_details(uuid,uuid,uuid) TO service_role;
