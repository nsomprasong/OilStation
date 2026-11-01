-- TEST-MODE ONLY: append-only SaaS refund ledger for succeeded provider refunds.
-- No Stripe refund is initiated here. Never credits pump wallets or pays sales
-- commission. Must be driven ONLY by signature-checked Stripe webhook in a
-- separately approved test environment, not browser-supplied invoice metadata.
CREATE TABLE IF NOT EXISTS public.saas_test_refund_journal(
 refund_id text PRIMARY KEY CHECK(refund_id ~ '^re_[A-Za-z0-9]{6,100}$'),
 first_event_id text NOT NULL UNIQUE REFERENCES public.stripe_events(id),
 invoice_id uuid NOT NULL REFERENCES public.saas_invoices(id),
 payment_attempt_id uuid NOT NULL REFERENCES public.saas_payment_attempts(id),
 payment_intent_id text NOT NULL CHECK(payment_intent_id ~ '^pi_[A-Za-z0-9]{6,100}$'),
 charge_id text NOT NULL CHECK(charge_id ~ '^ch_[A-Za-z0-9]{6,100}$'),
 amount_satang bigint NOT NULL CHECK(amount_satang BETWEEN 1 AND 99999999),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS saas_test_refund_by_invoice
 ON public.saas_test_refund_journal(invoice_id,created_at);
ALTER TABLE public.saas_test_refund_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_test_refund_journal FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saas_test_refund_journal FROM PUBLIC,anon,authenticated;

-- Journal rows are immutable even to mistaken privileged application writes.
CREATE OR REPLACE FUNCTION public.guard_saas_test_refund_journal()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REFUND_JOURNAL_IMMUTABLE';
END $fn$;
REVOKE ALL ON FUNCTION public.guard_saas_test_refund_journal()
 FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_saas_test_refund_journal ON public.saas_test_refund_journal;
CREATE TRIGGER guard_saas_test_refund_journal BEFORE UPDATE OR DELETE
 ON public.saas_test_refund_journal FOR EACH ROW
 EXECUTE FUNCTION public.guard_saas_test_refund_journal();

CREATE OR REPLACE FUNCTION public.reconcile_saas_test_succeeded_refund(
 p_event_id text,p_refund_id text,p_payment_intent_id text,p_charge_id text,
 p_amount_satang bigint,p_currency text,p_status text,p_livemode boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.stripe_events%ROWTYPE;
 a public.saas_payment_attempts%ROWTYPE;
 i public.saas_invoices%ROWTYPE;
 existing public.saas_test_refund_journal%ROWTYPE;
 v_invoice_id uuid;v_attempt_id uuid;
 v_refunded bigint;v_full boolean;
BEGIN
 IF p_livemode IS DISTINCT FROM false OR p_event_id IS NULL OR
   p_event_id !~ '^evt_[A-Za-z0-9]{6,100}$' OR
   p_refund_id IS NULL OR p_refund_id !~ '^re_[A-Za-z0-9]{6,100}$' OR
   p_payment_intent_id IS NULL OR
      p_payment_intent_id !~ '^pi_[A-Za-z0-9]{6,100}$' OR
   p_charge_id IS NULL OR p_charge_id !~ '^ch_[A-Za-z0-9]{6,100}$' OR
   p_currency<>'thb' OR p_status<>'succeeded' OR
   p_amount_satang NOT BETWEEN 1 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Same lock order as payment reconciliation: event, then invoice, attempt.
 SELECT * INTO e FROM public.stripe_events WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR e.event_type NOT IN ('refund.created','refund.updated')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT id,invoice_id INTO v_attempt_id,v_invoice_id
   FROM public.saas_payment_attempts WHERE stripe_payment_intent_id=p_payment_intent_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=v_invoice_id FOR UPDATE;
 SELECT * INTO a FROM public.saas_payment_attempts
   WHERE id=v_attempt_id AND invoice_id=i.id FOR UPDATE;
 IF NOT FOUND OR a.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id OR
   a.amount_satang<>i.total_satang OR
   a.status NOT IN ('succeeded','refunded') OR
   i.status NOT IN ('paid','refunded') OR
   i.pricing_snapshot->>'currency'<>'thb' OR
   i.pricing_snapshot->>'paymentMethod'<>a.payment_method
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Refund IDs, not webhook event IDs, are the durable provider identity.
 SELECT * INTO existing FROM public.saas_test_refund_journal
   WHERE refund_id=p_refund_id;
 IF FOUND THEN
   IF existing.invoice_id<>i.id OR existing.payment_attempt_id<>a.id OR
      existing.payment_intent_id<>p_payment_intent_id OR
      existing.charge_id<>p_charge_id OR
      existing.amount_satang<>p_amount_satang
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
   UPDATE public.stripe_events SET status='processed',
     processed_at=coalesce(processed_at,clock_timestamp()) WHERE id=p_event_id;
   RETURN jsonb_build_object('invoiceId',i.id,'status',i.status,
     'replayed',true,'refundId',p_refund_id);
 END IF;
 IF e.status<>'received'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT coalesce(sum(amount_satang),0) INTO v_refunded
 FROM public.saas_test_refund_journal WHERE invoice_id=i.id;
 IF v_refunded+p_amount_satang>i.total_satang OR i.status='refunded'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- No inferred payout/refund allocation across stations. Only append the
 -- provider-confirmed amount; full refund changes billing state atomically.
 INSERT INTO public.saas_test_refund_journal(
  refund_id,first_event_id,invoice_id,payment_attempt_id,
  payment_intent_id,charge_id,amount_satang)
 VALUES(p_refund_id,p_event_id,i.id,a.id,p_payment_intent_id,p_charge_id,p_amount_satang);
 v_refunded:=v_refunded+p_amount_satang;
 v_full:=v_refunded=i.total_satang;
 IF v_full THEN
  UPDATE public.saas_invoices SET status='refunded' WHERE id=i.id;
  UPDATE public.saas_payment_attempts SET status='refunded' WHERE id=a.id;
 END IF;
 UPDATE public.stripe_events SET status='processed',
  processed_at=clock_timestamp() WHERE id=p_event_id;
 RETURN jsonb_build_object('invoiceId',i.id,
  'status',CASE WHEN v_full THEN 'refunded' ELSE 'paid' END,
  'refundId',p_refund_id,'refundedSatang',v_refunded,
  'replayed',false,'fullRefund',v_full);
END $fn$;
REVOKE ALL ON FUNCTION public.reconcile_saas_test_succeeded_refund(
 text,text,text,text,bigint,text,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_saas_test_succeeded_refund(
 text,text,text,text,bigint,text,text,boolean) TO service_role;
