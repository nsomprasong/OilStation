-- Provider-reconciled TEST payment, never pump-credit wallet money.
-- Stripe HMAC signature is verified by the trusted Cloudflare Worker BEFORE
-- the event is inserted into stripe_events or the RPC is invoked.
-- A signed event cannot introduce new invoices or payment attempts.
CREATE OR REPLACE FUNCTION public.reconcile_saas_test_paid_event(
 p_event_id text,p_payment_intent_id text,p_invoice_id uuid,p_attempt_id uuid,
 p_amount_satang bigint,p_received_satang bigint,p_currency text,
 p_payment_status text,p_livemode boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_event public.stripe_events%ROWTYPE;
 v_invoice public.saas_invoices%ROWTYPE;
 v_attempt public.saas_payment_attempts%ROWTYPE;
BEGIN
 IF p_livemode IS DISTINCT FROM false OR p_event_id IS NULL
  OR p_event_id !~ '^evt_[A-Za-z0-9]{6,100}$'
  OR p_payment_intent_id IS NULL
  OR p_payment_intent_id !~ '^pi_[A-Za-z0-9]{6,100}$'
  OR p_currency<>'thb' OR p_payment_status<>'succeeded'
  OR p_amount_satang IS NULL OR p_received_satang IS NULL
  OR p_amount_satang NOT BETWEEN 1000 AND 99999999
  OR p_amount_satang<>p_received_satang
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_event FROM public.stripe_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.event_type<>'payment_intent.succeeded'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Invoice row lock serializes payment retries and other payment attempts.
 SELECT * INTO v_invoice FROM public.saas_invoices
   WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_attempt FROM public.saas_payment_attempts
   WHERE id=p_attempt_id AND invoice_id=v_invoice.id FOR UPDATE;
 IF NOT FOUND OR v_attempt.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
  OR v_attempt.amount_satang<>p_amount_satang OR
  v_invoice.total_satang<>p_amount_satang OR
  v_invoice.pricing_snapshot->>'currency'<>'thb' OR
  v_invoice.pricing_snapshot->>'paymentMethod'<>v_attempt.payment_method
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF v_event.status='processed' THEN
   IF v_attempt.status='succeeded' AND v_invoice.status='paid'
     THEN RETURN jsonb_build_object('invoiceId',v_invoice.id,'replayed',true,
       'status','paid');END IF;
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF v_event.status<>'received' OR v_attempt.status IN ('cancelled','refunded')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF v_invoice.status='paid' AND v_attempt.status='succeeded' THEN
   -- Another signed event for the SAME already settled PaymentIntent.
   UPDATE public.stripe_events SET status='processed',
      processed_at=clock_timestamp() WHERE id=p_event_id;
   RETURN jsonb_build_object('invoiceId',v_invoice.id,'replayed',true,'status','paid');
 END IF;
 IF v_invoice.status NOT IN ('issued','pending','overdue') OR
   v_attempt.status NOT IN ('created','requires_action','processing')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.saas_payment_attempts SET status='succeeded',
   settled_at=clock_timestamp() WHERE id=v_attempt.id;
 UPDATE public.saas_invoices SET status='paid',paid_at=clock_timestamp()
   WHERE id=v_invoice.id;
 UPDATE public.stripe_events SET status='processed',
   processed_at=clock_timestamp() WHERE id=p_event_id;
 RETURN jsonb_build_object('invoiceId',v_invoice.id,'replayed',false,
   'status','paid','amountSatang',p_amount_satang);
END $fn$;
REVOKE ALL ON FUNCTION public.reconcile_saas_test_paid_event(
 text,text,uuid,uuid,bigint,bigint,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_saas_test_paid_event(
 text,text,uuid,uuid,bigint,bigint,text,text,boolean) TO service_role;
