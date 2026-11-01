-- TEST MODE ONLY: signed provider dispute lifecycle snapshots for manual
-- chargeback review. This is NOT a financial journal, dispute resolution,
-- payout reversal, refund or bank balance reconciliation.
-- Stripe events may be delivered out of order: store immutable event history
-- and its source timestamp, never overwrite an apparent latest state.
CREATE TABLE public.saas_test_dispute_review_events(
 event_id text PRIMARY KEY REFERENCES public.stripe_events(id),
 dispute_id text NOT NULL CHECK(dispute_id ~ '^du_[A-Za-z0-9]{6,100}$'),
 invoice_id uuid NOT NULL REFERENCES public.saas_invoices(id),
 attempt_id uuid NOT NULL REFERENCES public.saas_payment_attempts(id),
 payment_intent_id text NOT NULL CHECK(payment_intent_id ~ '^pi_[A-Za-z0-9]{6,100}$'),
 charge_id text NOT NULL CHECK(charge_id ~ '^ch_[A-Za-z0-9]{6,100}$'),
 event_type text NOT NULL CHECK(event_type IN
  ('charge.dispute.created','charge.dispute.updated','charge.dispute.closed')),
 event_created bigint NOT NULL CHECK(event_created BETWEEN 1 AND 9999999999),
 dispute_status text NOT NULL CHECK(dispute_status IN
  ('warning_needs_response','warning_under_review','warning_closed',
   'needs_response','under_review','won','lost','prevented')),
 amount_satang bigint NOT NULL CHECK(amount_satang BETWEEN 1 AND 99999999),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX saas_test_dispute_review_by_invoice
 ON public.saas_test_dispute_review_events(invoice_id,dispute_id,event_created DESC);
ALTER TABLE public.saas_test_dispute_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_test_dispute_review_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_test_dispute_review_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guard_saas_test_dispute_review_events()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DISPUTE_HISTORY_IMMUTABLE';
END $fn$;
REVOKE ALL ON FUNCTION public.guard_saas_test_dispute_review_events()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_saas_test_dispute_review_events BEFORE UPDATE OR DELETE
 ON public.saas_test_dispute_review_events FOR EACH ROW
 EXECUTE FUNCTION public.guard_saas_test_dispute_review_events();

CREATE OR REPLACE FUNCTION public.record_saas_test_dispute_review(
 p_event_id text,p_dispute_id text,p_payment_intent_id text,p_charge_id text,
 p_amount_satang bigint,p_currency text,p_dispute_status text,
 p_event_type text,p_event_created bigint,p_livemode boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.stripe_events%ROWTYPE;
 a public.saas_payment_attempts%ROWTYPE;
 i public.saas_invoices%ROWTYPE;
 older public.saas_test_dispute_review_events%ROWTYPE;
 old_event public.saas_test_dispute_review_events%ROWTYPE;
 v_invoice uuid;v_attempt uuid;
BEGIN
 IF p_livemode IS DISTINCT FROM false OR
  p_event_id IS NULL OR p_event_id !~ '^evt_[A-Za-z0-9]{6,100}$' OR
  p_dispute_id IS NULL OR p_dispute_id !~ '^du_[A-Za-z0-9]{6,100}$' OR
  p_payment_intent_id IS NULL OR
    p_payment_intent_id !~ '^pi_[A-Za-z0-9]{6,100}$' OR
  p_charge_id IS NULL OR p_charge_id !~ '^ch_[A-Za-z0-9]{6,100}$' OR
  p_currency<>'thb' OR p_amount_satang NOT BETWEEN 1 AND 99999999 OR
  p_event_created NOT BETWEEN 1 AND 9999999999 OR
  p_event_type NOT IN
   ('charge.dispute.created','charge.dispute.updated','charge.dispute.closed') OR
  p_dispute_status NOT IN
   ('warning_needs_response','warning_under_review','warning_closed',
    'needs_response','under_review','won','lost','prevented') OR
  (p_event_type='charge.dispute.closed' AND p_dispute_status NOT IN
    ('won','lost','warning_closed','prevented'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO e FROM public.stripe_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.event_type IS DISTINCT FROM p_event_type
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Only an ALREADY paid OilStation invoice with a pre-bound provider PI.
 SELECT id,invoice_id INTO v_attempt,v_invoice FROM public.saas_payment_attempts
   WHERE stripe_payment_intent_id=p_payment_intent_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=v_invoice FOR UPDATE;
 SELECT * INTO a FROM public.saas_payment_attempts
   WHERE id=v_attempt AND invoice_id=i.id FOR UPDATE;
 IF NOT FOUND OR a.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
  OR a.amount_satang<>i.total_satang
  OR a.status NOT IN ('succeeded','refunded')
  OR i.status NOT IN ('paid','refunded')
  OR i.pricing_snapshot->>'currency'<>'thb'
  OR i.pricing_snapshot->>'paymentMethod'<>a.payment_method
  OR p_amount_satang>i.total_satang
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO old_event FROM public.saas_test_dispute_review_events
   WHERE event_id=p_event_id;
 IF FOUND THEN
  IF old_event.dispute_id<>p_dispute_id OR old_event.invoice_id<>i.id OR
     old_event.attempt_id<>a.id OR
     old_event.payment_intent_id<>p_payment_intent_id OR
     old_event.charge_id<>p_charge_id OR
     old_event.amount_satang<>p_amount_satang OR
     old_event.dispute_status<>p_dispute_status OR
     old_event.event_type<>p_event_type OR
     old_event.event_created<>p_event_created
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
  RETURN jsonb_build_object('disputeId',p_dispute_id,'replayed',true,
    'invoiceId',i.id,'status',old_event.dispute_status,'reviewOnly',true);
 END IF;
 IF e.status<>'received'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO older FROM public.saas_test_dispute_review_events
  WHERE dispute_id=p_dispute_id LIMIT 1;
 IF FOUND AND (older.invoice_id<>i.id OR older.attempt_id<>a.id OR
   older.payment_intent_id<>p_payment_intent_id OR
   older.charge_id<>p_charge_id OR older.amount_satang<>p_amount_satang)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
 INSERT INTO public.saas_test_dispute_review_events(
   event_id,dispute_id,invoice_id,attempt_id,payment_intent_id,charge_id,
   event_type,event_created,dispute_status,amount_satang)
 VALUES(p_event_id,p_dispute_id,i.id,a.id,p_payment_intent_id,p_charge_id,
   p_event_type,p_event_created,p_dispute_status,p_amount_satang);
 UPDATE public.stripe_events SET status='processed',
   processed_at=clock_timestamp() WHERE id=p_event_id;
 -- NEVER mutate invoice, wallet, commissions, refunds or subscriptions here.
 RETURN jsonb_build_object('disputeId',p_dispute_id,'replayed',false,
   'invoiceId',i.id,'status',p_dispute_status,'reviewOnly',true);
END $fn$;
REVOKE ALL ON FUNCTION public.record_saas_test_dispute_review(
 text,text,text,text,bigint,text,text,text,bigint,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_saas_test_dispute_review(
 text,text,text,text,bigint,text,text,text,bigint,boolean) TO service_role;
