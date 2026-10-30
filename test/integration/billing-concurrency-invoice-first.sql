-- Transaction A: lock invoice, hold it while transaction B is attaching
-- the PaymentIntent. After 2s, acquire attempt. Attempt-first B deadlocks.
BEGIN;
SET LOCAL lock_timeout='7000ms';
SELECT id FROM public.saas_invoices
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' FOR UPDATE;
SELECT pg_sleep(2);
SELECT id FROM public.saas_payment_attempts
 WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' FOR UPDATE;
COMMIT;
