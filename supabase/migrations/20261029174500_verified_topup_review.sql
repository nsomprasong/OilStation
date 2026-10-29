-- Station manager may approve only after checking bank statement independently.
-- Self-approval is forbidden even when a user happens to hold both company and
-- station roles. The existing debt-first approval function remains atomic.
CREATE OR REPLACE FUNCTION public.review_verified_corporate_topup(
 p_actor_id uuid,p_request_id uuid,p_approved boolean,
 p_bank_received boolean,p_verified_bank_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE t public.topup_requests%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.topup_requests
  WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_approved AND (t.requested_by=p_actor_id OR t.requested_by IS NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SELF_APPROVAL_FORBIDDEN';
 END IF;
 IF p_approved AND (p_bank_received IS DISTINCT FROM true
  OR p_verified_bank_reference IS NULL
  OR length(btrim(p_verified_bank_reference)) NOT BETWEEN 6 AND 120)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BANK_CONFIRMATION_REQUIRED';END IF;
 IF p_approved AND NOT EXISTS(
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='oilstation-slips' AND o.name=t.slip_storage_path
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_EVIDENCE';END IF;
 RETURN public.review_corporate_topup(p_actor_id,p_request_id,
  p_approved,p_bank_received,p_verified_bank_reference);
END $fn$;
REVOKE ALL ON FUNCTION public.review_verified_corporate_topup(
 uuid,uuid,boolean,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_verified_corporate_topup(
 uuid,uuid,boolean,boolean,text) TO service_role;
