-- Private corporate transfer-slip intake. All balances remain unchanged until
-- an authorized station officer checks the incoming bank transfer separately.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('oilstation-slips','oilstation-slips',false,5242880,
  ARRAY['image/jpeg','image/png']::text[])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,
 allowed_mime_types=ARRAY['image/jpeg','image/png']::text[];

CREATE UNIQUE INDEX IF NOT EXISTS topup_request_unique_slip
 ON public.topup_requests(slip_storage_path)
 WHERE slip_storage_path IS NOT NULL;

CREATE OR REPLACE FUNCTION public.authorize_corporate_topup_upload(
 p_actor_id uuid,p_account_id uuid,p_station_bank_id uuid,p_amount_satang bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v public.corporate_station_accounts%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(
  SELECT 1 FROM public.station_bank_accounts b WHERE b.id=p_station_bank_id
   AND b.station_id=v.station_id AND b.active
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_BANK_ACCOUNT'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company'
   AND m.corporate_company_id=v.company_id
   AND (m.role_code IN ('corporate_admin','accountant','finance_manager')
     OR m.extra_permissions->>'request_topup'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_amount_satang IS NULL OR p_amount_satang<100
  OR p_amount_satang>100000000000 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 RETURN jsonb_build_object('allowed',true,'accountId',p_account_id,
   'stationId',v.station_id);
END $f$;

CREATE OR REPLACE FUNCTION public.request_corporate_topup(
 p_actor_id uuid,p_account_id uuid,p_station_bank_id uuid,
 p_amount_satang bigint,p_slip_path text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 PERFORM public.authorize_corporate_topup_upload(
  p_actor_id,p_account_id,p_station_bank_id,p_amount_satang);
 IF p_slip_path IS NULL OR p_slip_path !~
  ('^accounts/'||p_account_id::text||'/slips/'||
    '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'||
    '\.(jpg|png)$')
 OR NOT EXISTS(
  SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-slips'
   AND o.name=p_slip_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE'; END IF;
 INSERT INTO public.topup_requests(id,account_id,station_bank_id,amount_satang,
   slip_storage_path,requested_by,status)
 VALUES(v_id,p_account_id,p_station_bank_id,p_amount_satang,
   p_slip_path,p_actor_id,'pending');
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'topup_request',v_id::text,'topup_requested',
  jsonb_build_object('account_id',p_account_id,'amount_satang',p_amount_satang));
 RETURN jsonb_build_object('requestId',v_id,'status','pending',
   'verified',false,'addedPrepaidSatang','0');
END $f$;

CREATE OR REPLACE FUNCTION public.authorize_station_topup_slip(
 p_actor_id uuid,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE t public.topup_requests%ROWTYPE; v_station uuid;
BEGIN
 SELECT * INTO t FROM public.topup_requests WHERE id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 SELECT station_id INTO v_station FROM public.corporate_station_accounts
 WHERE id=t.account_id;
 IF NOT EXISTS(
  SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='station' AND m.station_id=v_station
   AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
     OR m.extra_permissions->>'approve_topup'='true')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF t.slip_storage_path IS NULL OR NOT EXISTS(
   SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-slips'
    AND o.name=t.slip_storage_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE'; END IF;
 RETURN jsonb_build_object('path',t.slip_storage_path);
END $f$;

REVOKE ALL ON FUNCTION public.authorize_corporate_topup_upload(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_corporate_topup(uuid,uuid,uuid,bigint,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.authorize_station_topup_slip(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_corporate_topup_upload(uuid,uuid,uuid,bigint)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.request_corporate_topup(uuid,uuid,uuid,bigint,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.authorize_station_topup_slip(uuid,uuid)
 TO service_role;
