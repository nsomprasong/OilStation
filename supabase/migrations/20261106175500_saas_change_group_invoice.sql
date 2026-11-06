-- One pre-paid invoice for all matching scheduled replacements in a billing group.
-- Reuses established immutable SaaS invoice and signed Stripe reconciliation ledger.
CREATE OR REPLACE FUNCTION public.platform_issue_saas_change_group_invoice(
 p_actor_id uuid,p_billing_group_id uuid,p_effective_at timestamptz,p_payment_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE g public.billing_groups%ROWTYPE;v_station record;
 c public.station_subscription_change_requests%ROWTYPE;
 v_sub public.station_subscriptions%ROWTYPE;
 v_lines jsonb:='[]'::jsonb;v_item record;
 v_count int:=0;v_subtotal bigint:=0;v_discount bigint:=0;v_tax bigint:=0;v_total bigint:=0;
 v_id uuid:=gen_random_uuid();v_start date;v_end date;v_next_end timestamptz;
 v_freq text;v_vat text;v_rate integer;v_q jsonb;v_line jsonb;
 v_invoice_number text;v_current_price bigint;v_current_discount bigint;
 v_current_tax bigint;v_current_total bigint;v_method text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='platform'
    AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_effective_at IS NULL OR p_effective_at<=clock_timestamp() OR
   p_payment_method NOT IN ('card','promptpay')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO g FROM public.billing_groups WHERE id=p_billing_group_id FOR UPDATE;
 IF NOT FOUND OR g.status<>'active'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_start:=(p_effective_at AT TIME ZONE 'UTC')::date;
 FOR v_station IN SELECT s.id FROM public.stations s
  JOIN public.billing_group_stations bgs ON bgs.station_id=s.id
  WHERE bgs.billing_group_id=g.id AND s.organization_id=g.organization_id
  ORDER BY s.id FOR UPDATE OF s
 LOOP
  SELECT * INTO c FROM public.station_subscription_change_requests x
   WHERE x.station_id=v_station.id AND x.status='pending'
     AND x.requested_effective_at=p_effective_at
   ORDER BY x.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN CONTINUE;END IF;
  IF c.payment_invoice_id IS NOT NULL OR c.payment_status<>'unconfirmed'
    OR c.target_modules IS NULL OR cardinality(c.target_modules) NOT BETWEEN 1 AND 2
    OR c.price_snapshot->>'paymentMethod' IS DISTINCT FROM p_payment_method
    OR c.requested_effective_at<>c.old_period_end_snapshot
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  SELECT * INTO v_sub FROM public.station_subscriptions ss
   WHERE ss.id=c.current_subscription_id AND ss.station_id=c.station_id FOR UPDATE;
  IF NOT FOUND OR v_sub.plan_id<>c.current_plan_id OR
     v_sub.current_period_end<>c.old_period_end_snapshot OR
     v_sub.status NOT IN ('trialing','active','grace','overdue')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  SELECT billing_frequency INTO v_freq FROM public.pricing_plans
   WHERE id=c.next_plan_id AND active;
  IF v_freq NOT IN ('monthly','yearly') OR v_freq IS NULL
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  v_next_end:=public.saas_next_period_end_utc(p_effective_at,v_freq);
  IF v_end IS NULL OR v_end<(v_next_end AT TIME ZONE 'UTC')::date
   THEN v_end:=(v_next_end AT TIME ZONE 'UTC')::date;END IF;
  -- No duplicate station billing for this new starting period, including ordinary group invoices.
  IF EXISTS(SELECT 1 FROM public.saas_invoice_lines l
    JOIN public.saas_invoices i ON i.id=l.invoice_id
    WHERE l.station_id=c.station_id AND i.status NOT IN ('void','refunded')
      AND l.price_snapshot->>'serviceStart'=v_start::text)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  v_q:=c.price_snapshot;
  BEGIN
   v_current_price:=(v_q->>'subtotalSatang')::bigint;
   v_current_discount:=(v_q->>'discountSatang')::bigint;
   v_current_tax:=(v_q->>'taxSatang')::bigint;
   v_current_total:=(v_q->>'totalSatang')::bigint;
  EXCEPTION WHEN OTHERS THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END;
  IF v_current_price NOT BETWEEN 1000 AND 99999999 OR
   v_current_discount NOT BETWEEN 0 AND v_current_price OR
   v_current_tax NOT BETWEEN 0 AND 99999999 OR
   v_current_total NOT BETWEEN 1000 AND 99999999 OR
   v_q->>'vatMode' NOT IN ('inclusive','exclusive') OR
   (v_q->>'vatMode'='exclusive' AND
      v_current_total<>v_current_price-v_current_discount+v_current_tax) OR
   (v_q->>'vatMode'='inclusive' AND
      v_current_total<>v_current_price-v_current_discount)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  IF v_vat IS NULL THEN
   v_vat:=v_q->>'vatMode';v_rate:=(v_q->>'rateBasisPoints')::integer;
  ELSIF v_vat<>v_q->>'vatMode' OR v_rate<>(v_q->>'rateBasisPoints')::integer
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  v_subtotal:=v_subtotal+v_current_price;
  v_discount:=v_discount+v_current_discount;
  v_tax:=v_tax+v_current_tax;
  v_total:=v_total+v_current_total;v_count:=v_count+1;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
   'stationId',c.station_id,'changeId',c.id,'planId',c.next_plan_id,
   'targetModules',to_jsonb(c.target_modules),'serviceEnd',(v_next_end AT TIME ZONE 'UTC')::date,
   'subtotal',v_current_price,'discount',v_current_discount,'tax',v_current_tax));
 END LOOP;
 IF v_count<1 OR v_subtotal NOT BETWEEN 1000 AND 99999999
   OR v_total NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF EXISTS(SELECT 1 FROM public.saas_invoice_period_claims pc
   WHERE pc.billing_group_id=g.id AND pc.service_start=v_start AND pc.service_end=v_end)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_invoice_number:='OSC-'||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYYMMDD')||'-'||
   substring(replace(v_id::text,'-','') from 1 for 16);
 INSERT INTO public.saas_invoices(id,billing_group_id,invoice_number,
  subtotal_satang,discount_satang,tax_satang,total_satang,status,pricing_snapshot)
 VALUES(v_id,g.id,v_invoice_number,v_subtotal,v_discount,v_tax,v_total,'draft',
  jsonb_build_object('currency','thb','paymentMethod',p_payment_method,
   'vatMode',v_vat,'taxRateBasisPoints',v_rate,'serviceStart',v_start,
   'serviceEnd',v_end,'changeGroupInvoice',true,'effectiveAtUtc',p_effective_at));
 FOR v_item IN SELECT value AS x FROM jsonb_array_elements(v_lines) LOOP
  v_line:=v_item.x;
  INSERT INTO public.saas_invoice_lines(invoice_id,station_id,module_code,
   description,quantity,amount_satang,discount_satang,price_snapshot)
  VALUES(v_id,(v_line->>'stationId')::uuid,NULL,'SaaS scheduled plan replacement',1,
   (v_line->>'subtotal')::bigint,(v_line->>'discount')::bigint,
   jsonb_build_object('planId',v_line->>'planId',
    'changeId',v_line->>'changeId','targetModules',v_line->'targetModules',
    'serviceStart',v_start,'serviceEnd',v_line->'serviceEnd',
    'allocatedTaxSatang',(v_line->>'tax')::bigint,
    'commissionBaseSatang',(v_line->>'subtotal')::bigint-(v_line->>'discount')::bigint));
  UPDATE public.station_subscription_change_requests SET payment_invoice_id=v_id
   WHERE id=(v_line->>'changeId')::uuid AND status='pending' AND payment_invoice_id IS NULL;
 END LOOP;
 INSERT INTO public.saas_invoice_period_claims(invoice_id,billing_group_id,
   service_start,service_end,created_by)
 VALUES(v_id,g.id,v_start,v_end,p_actor_id);
 UPDATE public.saas_invoices SET status='issued',
   issued_at=clock_timestamp(),due_at=p_effective_at WHERE id=v_id;
 RETURN jsonb_build_object('invoiceId',v_id,'status','issued','stationCount',v_count,
   'totalSatang',v_total,'replayed',false);
END $fn$;

REVOKE ALL ON FUNCTION public.platform_issue_saas_change_group_invoice(uuid,uuid,timestamptz,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_issue_saas_change_group_invoice(uuid,uuid,timestamptz,text)
 TO service_role;
