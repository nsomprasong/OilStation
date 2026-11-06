-- Run in isolated BEGIN ... ROLLBACK after migration chain.
DO $qa$
DECLARE s public.station_subscriptions%ROWTYPE;
 owner_id uuid;admin_id uuid;group_id uuid;target_plan uuid;
 q jsonb;request jsonb;issued jsonb;v_changes int;v_amount bigint;
BEGIN
 SELECT * INTO s FROM public.station_subscriptions
 WHERE status IN ('trialing','active','grace','overdue') ORDER BY created_at LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing QA subscription';END IF;
 SELECT user_id INTO owner_id FROM public.memberships
 WHERE station_id=s.station_id AND active AND role_code IN ('station_owner','owner') LIMIT 1;
 SELECT user_id INTO admin_id FROM public.memberships
 WHERE scope_type='platform' AND role_code='platform_superadmin' AND active LIMIT 1;
 SELECT billing_group_id INTO group_id FROM public.billing_group_stations
 WHERE station_id=s.station_id LIMIT 1;
 SELECT id INTO target_plan FROM public.pricing_plans
 WHERE active AND id<>s.plan_id ORDER BY created_at DESC LIMIT 1;
 IF owner_id IS NULL OR admin_id IS NULL OR group_id IS NULL OR target_plan IS NULL
 THEN RAISE EXCEPTION 'QA fixture incomplete';END IF;
 q:=public.station_saas_quote_change(owner_id,s.station_id,target_plan,'card',
   ARRAY['hr_payroll','qr_coupon']);
 IF q->>'status'<>'QUOTE_ONLY_NO_PAYMENT_OR_ENTITLEMENT_MUTATION'
 THEN RAISE EXCEPTION 'owner quote failed';END IF;
 request:=public.station_saas_schedule_change_v2(owner_id,s.station_id,target_plan,
  'card',s.current_period_end,'qa-group-rollback-20261106',ARRAY['hr_payroll','qr_coupon']);
 IF request->>'status'<>'pending' THEN RAISE EXCEPTION 'schedule failed';END IF;
 issued:=public.platform_issue_saas_change_group_invoice(admin_id,group_id,
  s.current_period_end,'card');
 IF issued->>'status'<>'issued' THEN RAISE EXCEPTION 'group invoice issue failed: %',issued;END IF;
 SELECT count(*) INTO v_changes FROM public.station_subscription_change_requests
 WHERE station_id=s.station_id AND status='pending'
  AND payment_invoice_id=(issued->>'invoiceId')::uuid;
 IF v_changes<>1 THEN RAISE EXCEPTION 'invoice not linked to pending change';END IF;
 SELECT total_satang INTO v_amount FROM public.saas_invoices WHERE id=(issued->>'invoiceId')::uuid;
 IF v_amount<>(q->'quote'->>'totalSatang')::bigint
 THEN RAISE EXCEPTION 'quoted and invoiced totals disagree % v %',v_amount,q;END IF;
 IF (SELECT count(*) FROM public.saas_invoice_lines WHERE invoice_id=(issued->>'invoiceId')::uuid)<>1
 THEN RAISE EXCEPTION 'group station invoice line count wrong';END IF;
 -- Invoiced pending changes are not cancellable without a payment/refund review.
 BEGIN
  PERFORM public.station_saas_cancel_change(owner_id,s.station_id,(request->>'changeId')::uuid);
  RAISE EXCEPTION 'cancel of issued invoice unexpectedly permitted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM<>'INVALID_REQUEST' THEN RAISE;END IF;
 END;
 RAISE NOTICE 'PASS: scoped quote, scheduled group invoice, amount, and no unpaid cancellation';
END $qa$;
