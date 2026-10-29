-- Stripe PaymentIntent TEST foundation: only previously issued, immutable,
-- locally priced SaaS invoices; never station wallet top-ups.
-- No production use until staging PostgreSQL and Stripe integration gates.
CREATE OR REPLACE FUNCTION public.prepare_saas_test_payment(
 p_actor_id uuid,p_invoice_id uuid,p_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE i public.saas_invoices%ROWTYPE;
 g public.billing_groups%ROWTYPE;
 a public.saas_payment_attempts%ROWTYPE;
 v_id uuid:=gen_random_uuid();
BEGIN
 IF p_method NOT IN ('card','promptpay') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND OR i.status NOT IN ('issued','pending','overdue')
  OR i.total_satang NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO g FROM public.billing_groups WHERE id=i.billing_group_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active
    AND ((m.scope_type='organization' AND m.organization_id=g.organization_id
      AND m.role_code IN ('organization_owner','owner','manager','billing_manager'))
       OR (m.scope_type='platform' AND m.role_code IN ('platform_superadmin'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 -- Issued invoice pricing is the authority, including tax and PromptPay discount.
 -- Never allow users to change method after invoice issue without a reissue.
 IF i.pricing_snapshot->>'paymentMethod' IS DISTINCT FROM p_method OR
   (i.pricing_snapshot->>'currency') IS DISTINCT FROM 'thb'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Verify issued invoice arithmetic against a reviewed VAT snapshot.
 IF i.discount_satang>i.subtotal_satang OR coalesce(i.pricing_snapshot->>'vatMode','') NOT IN ('inclusive','exclusive')
   OR (i.pricing_snapshot->>'vatMode'='inclusive'
      AND i.total_satang<>i.subtotal_satang-i.discount_satang)
   OR (i.pricing_snapshot->>'vatMode'='exclusive'
      AND i.total_satang<>i.subtotal_satang-i.discount_satang+i.tax_satang)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Every line must be attached to this billing group; never let an admin
 -- accidentally settle another station or an empty/forged invoice.
 IF NOT EXISTS(SELECT 1 FROM public.saas_invoice_lines l WHERE l.invoice_id=i.id)
  OR EXISTS(
   SELECT 1 FROM public.saas_invoice_lines l
   LEFT JOIN public.billing_group_stations bgs
    ON bgs.station_id=l.station_id AND bgs.billing_group_id=i.billing_group_id
   WHERE l.invoice_id=i.id AND bgs.station_id IS NULL
  )
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO a FROM public.saas_payment_attempts
  WHERE invoice_id=i.id AND status IN
   ('created','requires_action','processing','succeeded')
  ORDER BY created_at ASC FOR UPDATE LIMIT 1;
 IF FOUND THEN
  -- Stripe idempotency retention is not perpetual; after a long outage,
  -- fail closed and require reconciliation rather than create a second PI.
  IF a.stripe_payment_intent_id IS NULL AND
     a.created_at<clock_timestamp()-interval '20 hours'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  IF a.payment_method<>p_method OR a.amount_satang<>i.total_satang
     OR a.status='succeeded'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 ELSE
  INSERT INTO public.saas_payment_attempts(
   id,invoice_id,payment_method,amount_satang,idempotency_key,status)
  VALUES(v_id,i.id,p_method,i.total_satang,'oilstation-pi-'||v_id::text,'created')
  RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('attemptId',a.id,'amountSatang',a.amount_satang,
  'idempotencyKey',a.idempotency_key,'paymentIntentId',a.stripe_payment_intent_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.attach_saas_test_intent(
 p_actor_id uuid,p_attempt_id uuid,p_payment_intent_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a public.saas_payment_attempts%ROWTYPE;
 i public.saas_invoices%ROWTYPE;g public.billing_groups%ROWTYPE;
BEGIN
 IF p_payment_intent_id IS NULL OR p_payment_intent_id !~ '^pi_[A-Za-z0-9]{6,100}$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO a FROM public.saas_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=a.invoice_id FOR UPDATE;
 SELECT * INTO g FROM public.billing_groups WHERE id=i.billing_group_id;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND ((m.scope_type='organization' AND m.organization_id=g.organization_id
      AND m.role_code IN ('organization_owner','owner','manager','billing_manager'))
   OR (m.scope_type='platform' AND m.role_code IN ('platform_superadmin'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF a.status NOT IN ('created','requires_action','processing')
   OR a.stripe_payment_intent_id IS NOT NULL AND
     a.stripe_payment_intent_id<>p_payment_intent_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.saas_payment_attempts SET
  stripe_payment_intent_id=p_payment_intent_id WHERE id=a.id;
 RETURN jsonb_build_object('paymentIntentId',p_payment_intent_id);
END $fn$;
REVOKE ALL ON FUNCTION public.prepare_saas_test_payment(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.attach_saas_test_intent(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_saas_test_payment(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_saas_test_intent(uuid,uuid,text) TO service_role;
