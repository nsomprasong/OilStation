DO $assert$
DECLARE v_failed boolean:=false;
BEGIN
 IF (SELECT stripe_payment_intent_id FROM public.saas_payment_attempts
  WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')<>'pi_Concurrent123456'
  OR (SELECT status FROM public.saas_invoices
  WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'issued'
  OR (SELECT count(*) FROM public.saas_payment_attempts
  WHERE invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1
 THEN RAISE EXCEPTION 'concurrent_lock_test_not_accurately_attached';END IF;
 -- Amount mismatch and attempt/invoice drift must fail closed.
 UPDATE public.saas_invoices SET status='paid' WHERE id=
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 BEGIN
  PERFORM public.attach_saas_test_intent(
   '22222222-2222-4222-8222-222222222222',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'pi_Concurrent123456');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'paid_invoice_rebound_payment_intent';END IF;
END $assert$;
