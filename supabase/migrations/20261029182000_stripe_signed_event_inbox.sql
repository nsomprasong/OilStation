-- Immutable signed Stripe event receipt. No invoice or fund mutation until
-- a separate provider-reconciled processor is implemented and reviewed.
CREATE OR REPLACE FUNCTION public.record_stripe_signed_event(
 p_event_id text,p_event_type text,p_payload_hash text,p_livemode boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE r public.stripe_events%ROWTYPE; v_inserted integer;
BEGIN
 IF p_livemode IS DISTINCT FROM false OR p_event_id IS NULL OR
   p_event_id !~ '^evt_[A-Za-z0-9]{6,100}$' OR
   p_event_type IS NULL OR p_event_type !~ '^[a-z][a-z0-9_.]{2,90}$' OR
   p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.stripe_events(id,event_type,payload_hash,status)
 VALUES(p_event_id,p_event_type,p_payload_hash,'received')
 ON CONFLICT(id) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 SELECT * INTO r FROM public.stripe_events WHERE id=p_event_id FOR UPDATE;
 IF r.payload_hash IS DISTINCT FROM p_payload_hash OR r.event_type IS DISTINCT FROM p_event_type
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
 RETURN jsonb_build_object('eventId',r.id,'replayed',v_inserted=0,'status',r.status);
END $fn$;
REVOKE ALL ON FUNCTION public.record_stripe_signed_event(text,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_signed_event(text,text,text,boolean)
 TO service_role;
