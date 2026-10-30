-- Disposable PostgreSQL concurrent-lock setup, never customer data.
INSERT INTO public.billing_groups(
 id,organization_id,name,autopay_consent,status
) VALUES(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Concurrent payment test',false,'active');
INSERT INTO public.saas_invoices(
 id,billing_group_id,invoice_number,subtotal_satang,discount_satang,tax_satang,
 total_satang,status,issued_at,pricing_snapshot
) VALUES(
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','TEST-CONCURRENT-001',
 1200,0,0,1200,'issued',now(),
 '{"paymentMethod":"card","currency":"thb","vatMode":"inclusive"}'::jsonb);
INSERT INTO public.saas_payment_attempts(
 id,invoice_id,payment_method,amount_satang,idempotency_key,status
) VALUES(
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'card',1200,'oilstation-concurrency-test','created');
