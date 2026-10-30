-- Transaction B starts while A holds invoice lock. New attach must
-- wait for the invoice first and cannot capture attempt ahead of A.
SET lock_timeout='7000ms';
SELECT public.attach_saas_test_intent(
 '22222222-2222-4222-8222-222222222222',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'pi_Concurrent123456');
