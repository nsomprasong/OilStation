-- Guard the invoice and PaymentIntent financial agreement even from a
-- mistaken privileged adapter update. Corrections must void/reissue instead.
CREATE OR REPLACE FUNCTION public.guard_issued_saas_invoice_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
 IF OLD.status<>'draft' AND (
   NEW.billing_group_id IS DISTINCT FROM OLD.billing_group_id OR
   NEW.subtotal_satang IS DISTINCT FROM OLD.subtotal_satang OR
   NEW.discount_satang IS DISTINCT FROM OLD.discount_satang OR
   NEW.tax_satang IS DISTINCT FROM OLD.tax_satang OR
   NEW.total_satang IS DISTINCT FROM OLD.total_satang OR
   NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVOICE_SNAPSHOT_IMMUTABLE';END IF;
 IF OLD.status='paid' AND NEW.status NOT IN ('paid','refunded')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAID_INVOICE_LOCKED';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_issued_saas_invoice_snapshot()
 FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_issued_saas_invoice_snapshot ON public.saas_invoices;
CREATE TRIGGER guard_issued_saas_invoice_snapshot
 BEFORE UPDATE ON public.saas_invoices FOR EACH ROW
 EXECUTE FUNCTION public.guard_issued_saas_invoice_snapshot();

CREATE OR REPLACE FUNCTION public.guard_saas_invoice_line_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
DECLARE v_id uuid;v_status text;
BEGIN
 IF TG_OP='DELETE' THEN v_id:=OLD.invoice_id;
 ELSE v_id:=NEW.invoice_id;END IF;
 SELECT status INTO v_status FROM public.saas_invoices WHERE id=v_id FOR UPDATE;
 IF v_status IS DISTINCT FROM 'draft'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVOICE_SNAPSHOT_IMMUTABLE';END IF;
 IF TG_OP='UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVOICE_SNAPSHOT_IMMUTABLE';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_saas_invoice_line_snapshot()
 FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_saas_invoice_line_snapshot ON public.saas_invoice_lines;
CREATE TRIGGER guard_saas_invoice_line_snapshot
 BEFORE INSERT OR UPDATE OR DELETE ON public.saas_invoice_lines FOR EACH ROW
 EXECUTE FUNCTION public.guard_saas_invoice_line_snapshot();

CREATE OR REPLACE FUNCTION public.guard_saas_attempt_payment_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $fn$
BEGIN
 IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
    NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
    NEW.amount_satang IS DISTINCT FROM OLD.amount_satang OR
    NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR
    (OLD.stripe_payment_intent_id IS NOT NULL AND
     NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYMENT_ATTEMPT_IMMUTABLE';END IF;
 IF OLD.status='succeeded' AND NEW.status NOT IN ('succeeded','refunded')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAID_PAYMENT_ATTEMPT_LOCKED';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_saas_attempt_payment_reference()
 FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_saas_attempt_payment_reference ON public.saas_payment_attempts;
CREATE TRIGGER guard_saas_attempt_payment_reference
 BEFORE UPDATE ON public.saas_payment_attempts FOR EACH ROW
 EXECUTE FUNCTION public.guard_saas_attempt_payment_reference();

CREATE INDEX IF NOT EXISTS saas_invoices_group_created_idx
 ON public.saas_invoices(billing_group_id,created_at DESC)
 WHERE status IN ('issued','pending','overdue','paid');
CREATE INDEX IF NOT EXISTS saas_attempt_active_invoice_idx
 ON public.saas_payment_attempts(invoice_id,created_at)
 WHERE status IN ('created','requires_action','processing','succeeded');
