-- Execute only after 2026110616/17 migrations inside BEGIN ... ROLLBACK.
-- Synthetic payment rows exist only inside a rolled-back test transaction.
DO $qa$
DECLARE s public.station_subscriptions%ROWTYPE; owner_id uuid; group_id uuid; target_plan uuid;
 inv uuid:=gen_random_uuid(); due_at timestamptz:=clock_timestamp()-interval '5 minutes';
 attempt_id uuid:=gen_random_uuid();event_id text;payment_id text;
 change_id uuid;v jsonb;active_id uuid;
BEGIN
 SELECT * INTO s FROM public.station_subscriptions WHERE status IN ('trialing','active','grace','overdue')
  ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing QA subscription';END IF;
 SELECT user_id INTO owner_id FROM public.memberships WHERE station_id=s.station_id
  AND active AND role_code IN ('station_owner','owner') LIMIT 1;
 SELECT billing_group_id INTO group_id FROM public.billing_group_stations WHERE station_id=s.station_id LIMIT 1;
 SELECT id INTO target_plan FROM public.pricing_plans WHERE id<>s.plan_id AND active LIMIT 1;
 IF owner_id IS NULL OR group_id IS NULL OR target_plan IS NULL THEN RAISE EXCEPTION 'missing synthetic prerequisites';END IF;
 -- Modify a real QA subscription ONLY inside this ROLLBACK transaction to simulate a due boundary.
 UPDATE public.station_subscriptions SET current_period_end=due_at WHERE id=s.id;
 INSERT INTO public.saas_invoices(id,billing_group_id,invoice_number,subtotal_satang,discount_satang,
  tax_satang,total_satang,status,paid_at,issued_at,pricing_snapshot)
 VALUES(inv,group_id,'QA-ROLLBACK-'||replace(inv::text,'-',''),10000,0,700,10700,
  'issued',NULL,clock_timestamp(),jsonb_build_object(
   'qaOnly',true,'currency','thb','paymentMethod','card','vatMode','exclusive',
   'serviceStart',(due_at AT TIME ZONE 'UTC')::date,
   'serviceEnd',((due_at+interval '1 year') AT TIME ZONE 'UTC')::date));
 payment_id:='pi_QArollback'||replace(inv::text,'-','');
 event_id:='evt_QArollback'||replace(inv::text,'-','');
 INSERT INTO public.saas_payment_attempts(id,invoice_id,payment_method,amount_satang,
  stripe_payment_intent_id,idempotency_key,status)
 VALUES(attempt_id,inv,'card',10700,payment_id,
  'qa-rollback-payment-'||inv::text,'created');
 INSERT INTO public.station_subscription_change_requests(station_id,requested_by,
  current_subscription_id,current_plan_id,next_plan_id,old_period_end_snapshot,
  requested_effective_at,renewal_anchor_day,idempotency_key,request_fingerprint,
  price_snapshot,status,payment_status,target_modules,payment_invoice_id)
 VALUES(s.station_id,owner_id,s.id,s.plan_id,target_plan,due_at,due_at,1,
  'qa-positive-'||inv::text,'qa-paid-synthetic-fingerprint-'||inv::text,
  jsonb_build_object('totalSatang','10700','paymentMethod','card'),
  'pending','unconfirmed',ARRAY['qr_coupon'],inv)
 RETURNING id INTO change_id;
 v:=public.oilstation_apply_due_saas_changes(20);
 IF (v->>'applied')::int<>0 THEN RAISE EXCEPTION 'unpaid invoice activated';END IF;
 PERFORM public.record_stripe_signed_event(event_id,'payment_intent.succeeded',repeat('a',64),false);
 v:=public.reconcile_saas_test_paid_event(event_id,payment_id,inv,attempt_id,
   10700,10700,'thb','succeeded',false);
 IF v->>'status'<>'paid' THEN RAISE EXCEPTION 'test provider event not reconciled';END IF;
 v:=public.oilstation_apply_due_saas_changes(20);
 IF (v->>'applied')::int<>1 THEN RAISE EXCEPTION 'due application failed %',v;END IF;
 SELECT id INTO active_id FROM public.station_subscriptions
  WHERE station_id=s.station_id AND id<>s.id AND plan_id=target_plan AND status='active'
   AND starts_at=due_at;
 IF NOT FOUND THEN RAISE EXCEPTION 'new subscription not activated';END IF;
 IF (SELECT status FROM public.station_subscriptions WHERE id=s.id)<>'cancelled'
 OR (SELECT status FROM public.station_subscription_change_requests WHERE id=change_id)<>'applied'
 THEN RAISE EXCEPTION 'incorrect subscription transition';END IF;
 IF (SELECT status FROM public.station_modules WHERE station_id=s.station_id AND module_code='qr_coupon')<>'enabled'
 OR EXISTS(SELECT 1 FROM public.station_modules
   WHERE station_id=s.station_id AND module_code='hr_payroll' AND status='enabled')
 THEN RAISE EXCEPTION 'QR/HR entitlements not switched';END IF;
 v:=public.oilstation_apply_due_saas_changes(20);
 IF (v->>'applied')::int<>0 THEN RAISE EXCEPTION 'duplicate activation on replay';END IF;
 RAISE NOTICE 'PASS: synthetic signed-event reconciliation activated once; QR/HR changed';
END $qa$;
