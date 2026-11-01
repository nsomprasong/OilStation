-- Five-station consolidated invoice and PromptPay 2% discount test.
-- Disposable PostgreSQL ONLY. Fictitious Stripe event is not real provider evidence.
BEGIN;
DO $test$
DECLARE
 admin uuid:='11111111-1111-4111-8111-111111111111';
 owner uuid:='22222222-2222-4222-8222-222222222222';
 org uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 stations uuid[]:=ARRAY[
  'aaaaa001-1111-4111-8111-aaaaaaaaaaaa'::uuid,
  'aaaaa002-1111-4111-8111-aaaaaaaaaaaa'::uuid,
  'aaaaa003-1111-4111-8111-aaaaaaaaaaaa'::uuid,
  'aaaaa004-1111-4111-8111-aaaaaaaaaaaa'::uuid,
  'aaaaa005-1111-4111-8111-aaaaaaaaaaaa'::uuid];
 id uuid;plan uuid;group_id uuid;invoice_id uuid;attempt_id uuid;line_id uuid;
 d jsonb;v_count int;failed boolean;total bigint;
BEGIN
 FOR n IN 1..5 LOOP
  INSERT INTO public.stations(id,organization_id,name,timezone)
   VALUES(stations[n],org,'Fictional Consolidated Station '||n,'Asia/Bangkok');
  INSERT INTO public.station_modules(station_id,module_code,status)
   VALUES(stations[n],'qr_coupon','enabled');
 END LOOP;
 INSERT INTO public.station_modules(station_id,module_code,status)
   VALUES(stations[1],'hr_payroll','enabled');
 PERFORM public.platform_review_saas_tax_policy(admin,'exclusive',700,'2026-10-01');
 plan:=(public.platform_define_saas_flat_plan(admin,
  'qa_five_station_test','QA Five Station Plan','monthly',
   50000,70000,'2026-10-01')->>'planId')::uuid;
 group_id:=(public.platform_create_saas_billing_group(admin,org,
  'Fictional 5 Stations',stations)->>'billingGroupId')::uuid;
 FOREACH id IN ARRAY stations LOOP
   PERFORM public.platform_subscribe_saas_station(admin,id,plan,
     '2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
 END LOOP;
 d:=public.platform_draft_saas_flat_invoice(admin,group_id,'promptpay',
      '2026-10-01','2026-11-01');
 invoice_id:=(d->>'invoiceId')::uuid;
 -- 4 x QR 50000 + 1 x (QR 50000 + HR 70000) = 320000 satang.
 -- PromptPay 2% = 6400, VAT exclusive 7% of 313600 = 21952.
 IF d->>'status'<>'draft' OR (d->>'lineCount')::int<>6
   OR (d->>'subtotalSatang')::bigint<>320000
   OR (d->>'discountSatang')::bigint<>6400
   OR (d->>'taxSatang')::bigint<>21952
   OR (d->>'totalSatang')::bigint<>335552
 THEN RAISE EXCEPTION 'five_station_invoice_incorrect %',d; END IF;
 SELECT count(*) INTO v_count FROM public.saas_invoice_lines WHERE invoice_id=invoice_id;
 IF v_count<>6 THEN RAISE EXCEPTION 'consolidated_invoice_missing_lines';END IF;
 IF (SELECT count(distinct station_id) FROM public.saas_invoice_lines
      WHERE invoice_id=invoice_id)<>5
   OR (SELECT sum(discount_satang) FROM public.saas_invoice_lines
      WHERE invoice_id=invoice_id)<>6400
   OR (SELECT sum((price_snapshot->>'allocatedTaxSatang')::bigint)
      FROM public.saas_invoice_lines WHERE invoice_id=invoice_id)<>21952
 THEN RAISE EXCEPTION 'five_station_lines_discount_vat_inconsistent';END IF;
 d:=public.platform_draft_saas_flat_invoice(admin,group_id,'promptpay',
     '2026-10-01','2026-11-01');
 IF d->>'replayed'<>'true' OR (d->>'invoiceId')::uuid<>invoice_id
 THEN RAISE EXCEPTION 'duplicate_five_station_invoice';END IF;
 failed:=false;
 BEGIN
  PERFORM public.platform_draft_saas_flat_invoice(admin,group_id,'card',
     '2026-10-01','2026-11-01');
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'payment_method_repriced_issued_snapshot';END IF;
 PERFORM public.platform_issue_saas_invoice(admin,invoice_id);
 SELECT id INTO line_id FROM public.saas_invoice_lines WHERE invoice_id=invoice_id LIMIT 1;
 failed:=false;
 BEGIN
  PERFORM public.platform_paid_saas_commission_context(admin,line_id);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'unpaid_sales_commission_was_previewable';END IF;
 failed:=false;
 BEGIN
  PERFORM public.prepare_saas_test_payment(owner,invoice_id,'card');
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'payment_method_changed_after_issue';END IF;
 d:=public.prepare_saas_test_payment(owner,invoice_id,'promptpay');
 attempt_id:=(d->>'attemptId')::uuid;
 IF (d->>'amountSatang')::bigint<>335552
 THEN RAISE EXCEPTION 'payment_intent_amount_not_invoice_total';END IF;
 PERFORM public.attach_saas_test_intent(owner,attempt_id,'pi_QAFiveStationTest123456');
 PERFORM public.record_stripe_signed_event('evt_QAFiveStationTest123456',
    'payment_intent.succeeded',repeat('d',64),false);
 failed:=false;
 BEGIN
  PERFORM public.reconcile_saas_test_paid_event('evt_QAFiveStationTest123456',
   'pi_QAFiveStationTest123456',invoice_id,attempt_id,
    335552,335552,'usd','succeeded',false);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'wrong_currency_marked_5_station_invoice_paid';END IF;
 failed:=false;
 BEGIN
  PERFORM public.reconcile_saas_test_paid_event('evt_QAFiveStationTest123456',
   'pi_QAFiveStationTest123456',invoice_id,attempt_id,
    335552,335552,'thb','succeeded',true);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'livemode_payment_marked_qa_invoice_paid';END IF;
 failed:=false;
 BEGIN
  PERFORM public.reconcile_saas_test_paid_event('evt_QAFiveStationTest123456',
   'pi_QAFiveStationTest123456',invoice_id,attempt_id,
    335552,335551,'thb','succeeded',false);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT failed THEN RAISE EXCEPTION 'partial_provider_payment_marked_paid';END IF;
 d:=public.reconcile_saas_test_paid_event('evt_QAFiveStationTest123456',
   'pi_QAFiveStationTest123456',invoice_id,attempt_id,
    335552,335552,'thb','succeeded',false);
 IF d->>'status'<>'paid' OR d->>'replayed'<>'false'
 THEN RAISE EXCEPTION 'five_station_invoice_payment_failed %',d;END IF;
 d:=public.reconcile_saas_test_paid_event('evt_QAFiveStationTest123456',
   'pi_QAFiveStationTest123456',invoice_id,attempt_id,
    335552,335552,'thb','succeeded',false);
 IF d->>'replayed'<>'true' OR
   (SELECT count(*) FROM public.saas_payment_attempts WHERE invoice_id=invoice_id)<>1
 THEN RAISE EXCEPTION 'duplicate_invoice_payment_settled_twice';END IF;
 d:=public.platform_paid_saas_commission_context(admin,line_id);
 IF d->>'invoicePaid'<>'true' THEN RAISE EXCEPTION 'paid_invoice_sales_preview_denied';END IF;
 RAISE NOTICE 'PASS disposable five-station consolidated invoice with PromptPay discount, VAT and Stripe-event simulation';
END $test$;
ROLLBACK;
