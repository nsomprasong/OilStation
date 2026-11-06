-- Guarded link to an issued invoice; activate only when that invoice becomes PAID
-- through existing signed-payment reconciliation and the precise UTC boundary is due.
ALTER TABLE public.station_subscription_change_requests
 ADD COLUMN IF NOT EXISTS payment_invoice_id uuid REFERENCES public.saas_invoices(id);
CREATE INDEX IF NOT EXISTS saas_change_invoice_lookup
 ON public.station_subscription_change_requests(payment_invoice_id)
 WHERE payment_invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.platform_link_saas_change_invoice(
 p_actor_id uuid,p_change_id uuid,p_invoice_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE c public.station_subscription_change_requests%ROWTYPE;
 i public.saas_invoices%ROWTYPE;v_subtotal bigint;v_discount bigint;v_tax bigint;v_lines int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='platform'
   AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 -- Station lock serializes with owner schedule/cancel and future activation.
 PERFORM 1 FROM public.stations s WHERE s.id=(
  SELECT station_id FROM public.station_subscription_change_requests WHERE id=p_change_id
 ) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO c FROM public.station_subscription_change_requests WHERE id=p_change_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'pending' OR
    c.requested_effective_at<=clock_timestamp() OR
    c.payment_status NOT IN ('unconfirmed','confirmed')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF c.payment_invoice_id IS NOT NULL THEN
  IF c.payment_invoice_id<>p_invoice_id
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  RETURN jsonb_build_object('changeId',c.id,'invoiceId',p_invoice_id,'replayed',true);
 END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=p_invoice_id FOR SHARE;
 IF NOT FOUND OR i.status NOT IN ('issued','pending','paid') OR
   i.pricing_snapshot->>'currency'<>'thb' OR
   i.pricing_snapshot->>'paymentMethod' IS DISTINCT FROM c.price_snapshot->>'paymentMethod' OR
   i.pricing_snapshot->>'serviceStart' IS DISTINCT FROM
    (c.requested_effective_at AT TIME ZONE 'UTC')::date::text OR
   NOT EXISTS(SELECT 1 FROM public.billing_group_stations bgs
      WHERE bgs.station_id=c.station_id AND bgs.billing_group_id=i.billing_group_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF EXISTS(SELECT 1 FROM public.station_subscription_change_requests other
  WHERE other.id<>c.id AND other.station_id=c.station_id
   AND other.payment_invoice_id=p_invoice_id AND other.status IN ('pending','applied'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT count(*),coalesce(sum(l.amount_satang),0),coalesce(sum(l.discount_satang),0),
  coalesce(sum((l.price_snapshot->>'allocatedTaxSatang')::bigint),0)
 INTO v_lines,v_subtotal,v_discount,v_tax
 FROM public.saas_invoice_lines l WHERE l.invoice_id=p_invoice_id AND l.station_id=c.station_id;
 IF v_lines<1 OR v_subtotal<>(c.price_snapshot->>'subtotalSatang')::bigint OR
  v_discount<>(c.price_snapshot->>'discountSatang')::bigint OR
  v_tax<>(c.price_snapshot->>'taxSatang')::bigint OR
  EXISTS(SELECT 1 FROM public.saas_invoice_lines l
   WHERE l.invoice_id=p_invoice_id AND l.station_id=c.station_id
    AND (l.price_snapshot->>'planId' IS DISTINCT FROM c.next_plan_id::text OR
      l.price_snapshot->>'serviceStart' IS DISTINCT FROM
       (c.requested_effective_at AT TIME ZONE 'UTC')::date::text OR
      l.price_snapshot->'targetModules' IS DISTINCT FROM to_jsonb(c.target_modules)))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.station_subscription_change_requests
  SET payment_invoice_id=p_invoice_id WHERE id=c.id;
 RETURN jsonb_build_object('changeId',c.id,'invoiceId',p_invoice_id,'replayed',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_apply_due_saas_changes(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station record;c public.station_subscription_change_requests%ROWTYPE;
 v_old public.station_subscriptions%ROWTYPE;v_invoice public.saas_invoices%ROWTYPE;
 v_frequency text;v_new_end timestamptz;v_new_id uuid;v_module text;
 v_done integer:=0;v_scanned integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 FOR v_station IN
  SELECT s.id FROM public.stations s WHERE EXISTS(
    SELECT 1 FROM public.station_subscription_change_requests x
    WHERE x.station_id=s.id AND x.status='pending'
     AND x.requested_effective_at<=clock_timestamp())
  ORDER BY s.id FOR UPDATE OF s SKIP LOCKED LIMIT p_limit
 LOOP
  v_scanned:=v_scanned+1;
  SELECT * INTO c FROM public.station_subscription_change_requests x
   WHERE x.station_id=v_station.id AND x.status='pending'
   ORDER BY x.requested_effective_at,x.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR c.payment_invoice_id IS NULL OR c.payment_status='failed' OR
   c.target_modules IS NULL OR cardinality(c.target_modules) NOT BETWEEN 1 AND 2
  THEN CONTINUE; END IF;
  SELECT * INTO v_invoice FROM public.saas_invoices
   WHERE id=c.payment_invoice_id FOR SHARE;
  IF NOT FOUND OR v_invoice.status<>'paid' OR v_invoice.paid_at IS NULL OR
    NOT EXISTS(SELECT 1 FROM public.saas_payment_attempts a
       WHERE a.invoice_id=v_invoice.id AND a.status='succeeded'
        AND a.settled_at IS NOT NULL AND a.stripe_payment_intent_id IS NOT NULL)
  THEN CONTINUE; END IF;
  SELECT * INTO v_old FROM public.station_subscriptions ss
   WHERE ss.id=c.current_subscription_id AND ss.station_id=c.station_id FOR UPDATE;
  IF NOT FOUND OR v_old.plan_id<>c.current_plan_id OR
    v_old.current_period_end<>c.old_period_end_snapshot OR
    v_old.current_period_end<>c.requested_effective_at OR
    v_old.status NOT IN ('active','trialing','grace','overdue')
  THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.station_subscriptions ss
   WHERE ss.station_id=c.station_id AND ss.id<>v_old.id
    AND ss.status IN ('active','trialing','grace','overdue'))
  THEN CONTINUE;END IF;
  SELECT billing_frequency INTO v_frequency FROM public.pricing_plans
   WHERE id=c.next_plan_id AND active;
  IF v_frequency NOT IN ('monthly','yearly') OR v_frequency IS NULL
  THEN CONTINUE; END IF;
  v_new_end:=c.requested_effective_at+
   CASE WHEN v_frequency='monthly' THEN interval '1 month' ELSE interval '1 year' END;
  IF v_new_end<=clock_timestamp() THEN CONTINUE; END IF;
  -- Atomic old/new entitlement period transition, invoice and payment untouched.
  UPDATE public.station_subscriptions SET status='cancelled' WHERE id=v_old.id;
  INSERT INTO public.station_subscriptions(station_id,plan_id,starts_at,
    current_period_end,status)
   VALUES(c.station_id,c.next_plan_id,c.requested_effective_at,v_new_end,'active')
   RETURNING id INTO v_new_id;
  -- Entitlements change in the SAME transaction as the new paid subscription.
  UPDATE public.station_modules SET status='disabled',valid_until=c.requested_effective_at
   WHERE station_id=c.station_id AND NOT (module_code=ANY(c.target_modules))
    AND status<>'disabled';
  FOREACH v_module IN ARRAY c.target_modules LOOP
   INSERT INTO public.station_modules(station_id,module_code,status,valid_from,valid_until)
   VALUES(c.station_id,v_module,'enabled',c.requested_effective_at,NULL)
   ON CONFLICT (station_id,module_code) DO UPDATE
     SET status='enabled',valid_from=EXCLUDED.valid_from,valid_until=NULL;
  END LOOP;
  UPDATE public.station_subscription_change_requests
   SET status='applied',payment_status='confirmed',applied_at=clock_timestamp()
   WHERE id=c.id;
  v_done:=v_done+1;
 END LOOP;
 RETURN jsonb_build_object('scanned',v_scanned,'applied',v_done);
END $fn$;

REVOKE ALL ON FUNCTION public.platform_link_saas_change_invoice(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_apply_due_saas_changes(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_link_saas_change_invoice(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_apply_due_saas_changes(integer)
 TO service_role;
