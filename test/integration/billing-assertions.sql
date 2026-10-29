-- All assertions are performed against disposable PostgreSQL container.
BEGIN;
DO $t$
DECLARE
 admin uuid:='11111111-1111-4111-8111-111111111111';
 customer uuid:='22222222-2222-4222-8222-222222222222';
 station_a uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 station_b uuid:='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
 org_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 plan_id uuid;group_id uuid;invoice_id uuid;line_id uuid;attempt_id uuid;
 d jsonb;paid jsonb;v_amount bigint;v_count integer;v_err boolean;
BEGIN
 -- Unauthorized staff never controls platform prices/tax.
 v_err:=false;
 BEGIN
  PERFORM public.platform_review_saas_tax_policy(customer,'exclusive',700,'2026-10-01');
 EXCEPTION WHEN OTHERS THEN
  v_err:=SQLERRM='FORBIDDEN';
 END;
 IF NOT v_err THEN RAISE EXCEPTION 'cross_role_tax_allowed';END IF;
 -- Never let one organization's group contain a second organization's station.
 v_err:=false;
 BEGIN
  PERFORM public.platform_create_saas_billing_group(admin,org_a,'Cross org',
    ARRAY[station_a,station_b]);
 EXCEPTION WHEN OTHERS THEN
  v_err:=SQLERRM='INVALID_REQUEST';
 END;
 IF NOT v_err THEN RAISE EXCEPTION 'cross_org_group_allowed';END IF;

 PERFORM public.platform_review_saas_tax_policy(admin,'exclusive',700,'2026-10-01');
 SELECT (public.platform_define_saas_flat_plan(admin,'simple_2026','Simple Plan',
  'monthly',50000,70000,'2026-10-01')->>'planId')::uuid INTO plan_id;
 SELECT (public.platform_create_saas_billing_group(admin,org_a,'Group A',
   ARRAY[station_a])->>'billingGroupId')::uuid INTO group_id;
 PERFORM public.platform_subscribe_saas_station(admin,station_a,plan_id,
   '2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
 d:=public.platform_draft_saas_flat_invoice(admin,group_id,'card',
    '2026-10-01','2026-11-01');
 invoice_id:=(d->>'invoiceId')::uuid;
 IF d->>'status'<>'draft' OR (d->>'totalSatang')::bigint<>128400
    OR (d->>'lineCount')::int<>2
 THEN RAISE EXCEPTION 'wrong_invoice_quote %',d;END IF;
 SELECT count(*) INTO v_count FROM public.saas_invoice_lines
  WHERE invoice_id=invoice_id;
 IF v_count<>2 THEN RAISE EXCEPTION 'invoice_lines_missing';END IF;
 d:=public.platform_draft_saas_flat_invoice(admin,group_id,'card',
    '2026-10-01','2026-11-01');
 IF d->>'replayed'<>'true' OR (d->>'invoiceId')::uuid<>invoice_id
 THEN RAISE EXCEPTION 'duplicate_invoice_draft_created';END IF;
 -- Issued invoices and amounts remain immutable even to service-role callers.
 PERFORM public.platform_issue_saas_invoice(admin,invoice_id);
 v_err:=false;
 BEGIN
  UPDATE public.saas_invoices SET total_satang=1 WHERE id=invoice_id;
 EXCEPTION WHEN OTHERS THEN
  v_err:=SQLERRM='INVOICE_SNAPSHOT_IMMUTABLE';
 END;
 IF NOT v_err THEN RAISE EXCEPTION 'issued_invoice_price_mutable';END IF;
 v_err:=false;
 BEGIN
  UPDATE public.saas_invoice_lines SET discount_satang=999999
    WHERE invoice_id=invoice_id;
 EXCEPTION WHEN OTHERS THEN
  v_err:=SQLERRM='INVOICE_SNAPSHOT_IMMUTABLE';
 END;
 IF NOT v_err THEN RAISE EXCEPTION 'issued_invoice_line_mutable';END IF;
 SELECT (public.prepare_saas_test_payment(customer,invoice_id,'card')
      ->>'attemptId')::uuid INTO attempt_id;
 PERFORM public.attach_saas_test_intent(customer,attempt_id,'pi_TestSaaS123456');
 SELECT amount_satang INTO v_amount FROM public.saas_payment_attempts WHERE id=attempt_id;
 IF v_amount<>128400 THEN RAISE EXCEPTION 'wrong_stripe_charge';END IF;
 -- Stripe event receipt cannot be processed by an amount mismatch.
 PERFORM public.record_stripe_signed_event('evt_TestInvoice123456',
   'payment_intent.succeeded',repeat('a',64),false);
 v_err:=false;
 BEGIN
  PERFORM public.reconcile_saas_test_paid_event('evt_TestInvoice123456',
    'pi_TestSaaS123456',invoice_id,attempt_id,1000,1000,'thb','succeeded',false);
 EXCEPTION WHEN OTHERS THEN
  v_err:=SQLERRM='INVALID_REQUEST';
 END;
 IF NOT v_err THEN RAISE EXCEPTION 'tampered_payment_amount_accepted';END IF;
 paid:=public.reconcile_saas_test_paid_event('evt_TestInvoice123456',
    'pi_TestSaaS123456',invoice_id,attempt_id,128400,128400,'thb','succeeded',false);
 IF paid->>'status'<>'paid' OR paid->>'replayed'<>'false'
 THEN RAISE EXCEPTION 'valid_payment_not_settled';END IF;
 paid:=public.reconcile_saas_test_paid_event('evt_TestInvoice123456',
    'pi_TestSaaS123456',invoice_id,attempt_id,128400,128400,'thb','succeeded',false);
 IF paid->>'replayed'<>'true' THEN RAISE EXCEPTION 'duplicate_payment_charged';END IF;
 -- Sales preview is read-only; paid invoices do not automatically post payouts.
 SELECT id INTO line_id FROM public.saas_invoice_lines
   WHERE invoice_id=invoice_id ORDER BY id LIMIT 1;
 INSERT INTO public.sales_assignments(station_id,sales_user_id,effective_from,effective_until)
 VALUES(station_a,'33333333-3333-4333-8333-333333333333',
        '2026-09-30T17:00:00Z','2026-10-15T17:00:00Z'),
       (station_a,'44444444-4444-4444-8444-444444444444',
        '2026-10-15T17:00:00Z','2026-11-01T17:00:00Z');
 INSERT INTO public.commission_rules(station_id,sales_user_id,
   mode,amount,payout_policy,effective_from)
 VALUES(station_a,'33333333-3333-4333-8333-333333333333',
    'percent',10,'monthly','2026-09-30T17:00:00Z'),
       (station_a,'44444444-4444-4444-8444-444444444444',
    'percent',5,'monthly','2026-09-30T17:00:00Z');
 d:=public.platform_paid_saas_commission_context(admin,line_id);
 IF jsonb_array_length(d->'assignments')<>2
  OR d->>'invoicePaid'<>'true' THEN
  RAISE EXCEPTION 'missing_sales_allocation_context %',d;
 END IF;
 -- Assert test run never commits live funds or irrevocable commission payouts.
 IF EXISTS(SELECT 1 FROM public.saas_payment_attempts
   WHERE invoice_id=invoice_id AND status<>'succeeded')
 THEN RAISE EXCEPTION 'unexpected_attempt_state';END IF;
END $t$;
ROLLBACK;
