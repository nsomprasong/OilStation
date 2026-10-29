-- Safely draft a locally priced subscription invoice from platform reviewed
-- flat-price plans only. Non-flat methods, missing taxes or memberships fail.
-- Two-phase draft/issue; NEVER marks paid or posts commission.
CREATE TABLE IF NOT EXISTS public.saas_invoice_period_claims(
 invoice_id uuid PRIMARY KEY REFERENCES public.saas_invoices(id),
 billing_group_id uuid NOT NULL REFERENCES public.billing_groups(id),
 service_start date NOT NULL,
 service_end date NOT NULL,
 created_by uuid NOT NULL REFERENCES public.app_users(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT saas_invoice_valid_claim CHECK(service_start<service_end),
 CONSTRAINT saas_invoice_one_period UNIQUE(billing_group_id,service_start,service_end)
);
ALTER TABLE public.saas_invoice_period_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_invoice_period_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_invoice_period_claims FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.platform_draft_saas_flat_invoice(
 p_actor_id uuid,p_billing_group_id uuid,p_payment_method text,
 p_period_start date,p_period_end date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 g public.billing_groups%ROWTYPE;
 policy public.saas_tax_review_policies%ROWTYPE;
 station_record record;module_record record;
 subscription public.station_subscriptions%ROWTYPE;
 plan_record public.pricing_plans%ROWTYPE;
 rule_record public.pricing_rules%ROWTYPE;
 v_lines jsonb:='[]'::jsonb;
 v_line record;v_line_amount bigint;v_subtotal bigint:=0;
 v_count integer:=0;v_stations integer:=0;v_modules integer;
 v_id uuid:=gen_random_uuid();existing uuid;
 v_discount bigint;v_net bigint;v_tax bigint;v_total bigint;
 v_cumulative_price bigint:=0;v_prev_discount bigint:=0;
 v_cumulative_after bigint:=0;v_prev_tax bigint:=0;
 v_current_discount bigint;v_current_tax bigint;v_commission_base bigint;
 v_number text;v_invoice public.saas_invoices%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_payment_method NOT IN ('card','promptpay') OR
    p_period_start IS NULL OR p_period_end IS NULL OR
    p_period_end<=p_period_start OR p_period_end>p_period_start+370 OR
    p_period_end<p_period_start+27
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO g FROM public.billing_groups WHERE id=p_billing_group_id FOR UPDATE;
 IF NOT FOUND OR g.status<>'active'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT claim.invoice_id INTO existing FROM public.saas_invoice_period_claims claim
  WHERE claim.billing_group_id=g.id AND claim.service_start=p_period_start
   AND claim.service_end=p_period_end;
 IF FOUND THEN
  SELECT * INTO v_invoice FROM public.saas_invoices WHERE id=existing;
  IF v_invoice.pricing_snapshot->>'paymentMethod' IS DISTINCT FROM p_payment_method
     OR v_invoice.status='void'
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  RETURN jsonb_build_object('invoiceId',v_invoice.id,'status',v_invoice.status,
    'replayed',true,'totalSatang',v_invoice.total_satang);
 END IF;
 SELECT * INTO policy FROM public.saas_tax_review_policies
  WHERE effective_on<=p_period_start
  ORDER BY effective_on DESC,approved_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='TAX_POLICY_REQUIRED';END IF;
 FOR station_record IN
  SELECT bgs.station_id FROM public.billing_group_stations bgs
  JOIN public.stations s ON s.id=bgs.station_id
  WHERE bgs.billing_group_id=g.id AND s.organization_id=g.organization_id
  ORDER BY bgs.station_id
 LOOP
  v_stations:=v_stations+1;v_modules:=0;
  IF (SELECT count(*) FROM public.station_subscriptions sub
     WHERE sub.station_id=station_record.station_id
      AND sub.status IN ('trialing','active','grace','overdue'))<>1
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SUBSCRIPTION';END IF;
  SELECT * INTO subscription FROM public.station_subscriptions sub
   WHERE sub.station_id=station_record.station_id
     AND sub.status IN ('trialing','active','grace','overdue');
  SELECT * INTO plan_record FROM public.pricing_plans p
   WHERE p.id=subscription.plan_id AND p.active;
  IF NOT FOUND OR subscription.price_override_satang IS NOT NULL
     OR subscription.starts_at>p_period_start::timestamptz
     OR subscription.current_period_end<p_period_end::timestamptz
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SUBSCRIPTION';END IF;
  IF (plan_record.billing_frequency='monthly'
      AND p_period_end>p_period_start+35) OR
     (plan_record.billing_frequency='yearly'
      AND p_period_end<p_period_start+350)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SUBSCRIPTION';END IF;
  FOR module_record IN SELECT sm.module_code FROM public.station_modules sm
    WHERE sm.station_id=station_record.station_id AND sm.status='enabled'
    ORDER BY sm.module_code
  LOOP
   v_modules:=v_modules+1;
   SELECT * INTO rule_record FROM public.pricing_rules pr
    WHERE pr.plan_id=plan_record.id AND pr.module_code=module_record.module_code
      AND pr.billing_method='flat'
      AND pr.effective_at<=p_period_start::timestamptz
      AND (pr.expires_at IS NULL OR pr.expires_at>p_period_start::timestamptz)
    ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1;
   IF NOT FOUND OR rule_record.price_satang NOT BETWEEN 0 AND 99999999
     OR EXISTS(SELECT 1 FROM public.pricing_rules pr
       WHERE pr.plan_id=plan_record.id AND pr.module_code=module_record.module_code
        AND pr.billing_method<>'flat' AND pr.effective_at<=p_period_start::timestamptz
        AND (pr.expires_at IS NULL OR pr.expires_at>p_period_start::timestamptz))
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRICE_RULE_UNAVAILABLE';END IF;
   v_subtotal:=v_subtotal+rule_record.price_satang;
   v_count:=v_count+1;
   v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
     'stationId',station_record.station_id,'moduleCode',module_record.module_code,
     'ruleId',rule_record.id,'planId',plan_record.id,
     'priceSatang',rule_record.price_satang));
  END LOOP;
  IF v_modules=0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SUBSCRIPTION';END IF;
 END LOOP;
 -- Cross-organization group links must not silently disappear from a quote.
 IF v_stations=0 OR v_stations<>(SELECT count(*) FROM public.billing_group_stations
   WHERE billing_group_id=g.id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF v_subtotal NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_discount:=CASE WHEN p_payment_method='promptpay'
  THEN round(v_subtotal::numeric*2/100)::bigint ELSE 0 END;
 v_net:=v_subtotal-v_discount;
 v_tax:=CASE WHEN policy.vat_mode='exclusive'
    THEN round(v_net::numeric*policy.rate_basis_points/10000)::bigint
    ELSE round(v_net::numeric*policy.rate_basis_points/
      (10000+policy.rate_basis_points))::bigint END;
 v_total:=CASE WHEN policy.vat_mode='exclusive' THEN v_net+v_tax ELSE v_net END;
 IF v_total NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_number:='OS-'||to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYYMMDD')||'-'||
   substring(replace(v_id::text,'-','') from 1 for 16);
 INSERT INTO public.saas_invoices(
  id,billing_group_id,invoice_number,subtotal_satang,discount_satang,
  tax_satang,total_satang,status,pricing_snapshot)
 VALUES(v_id,g.id,v_number,v_subtotal,v_discount,v_tax,v_total,'draft',
    jsonb_build_object('currency','thb','paymentMethod',p_payment_method,
      'vatMode',policy.vat_mode,'taxRateBasisPoints',policy.rate_basis_points,
      'taxPolicyId',policy.id,'serviceStart',p_period_start,
      'serviceEnd',p_period_end,'discountPolicy',
      CASE WHEN p_payment_method='promptpay' THEN 'promptpay_2_percent' ELSE 'none' END));
 -- Cumulative rounding distributes exact discount/tax without leaking satang.
 FOR v_line IN SELECT value AS item FROM jsonb_array_elements(v_lines) LOOP
  v_line_amount:=(v_line.item->>'priceSatang')::bigint;
  v_cumulative_price:=v_cumulative_price+v_line_amount;
  v_current_discount:=round(v_discount::numeric*v_cumulative_price/v_subtotal)::bigint
    -v_prev_discount;
  v_prev_discount:=v_prev_discount+v_current_discount;
  v_cumulative_after:=v_cumulative_after+v_line_amount-v_current_discount;
  v_current_tax:=round(v_tax::numeric*v_cumulative_after/v_net)::bigint-v_prev_tax;
  v_prev_tax:=v_prev_tax+v_current_tax;
  v_commission_base:=v_line_amount-v_current_discount-
      CASE WHEN policy.vat_mode='inclusive' THEN v_current_tax ELSE 0 END;
  IF v_commission_base<0 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  INSERT INTO public.saas_invoice_lines(
    invoice_id,station_id,module_code,description,quantity,
    amount_satang,discount_satang,price_snapshot)
  VALUES(v_id,(v_line.item->>'stationId')::uuid,v_line.item->>'moduleCode',
    CASE WHEN v_line.item->>'moduleCode'='qr_coupon'
      THEN 'QR Fuel Coupon subscription' ELSE 'HR & Payroll subscription' END,
    1,v_line_amount,v_current_discount,
    jsonb_build_object('ruleId',v_line.item->>'ruleId',
      'planId',v_line.item->>'planId',
      'serviceStart',p_period_start,'serviceEnd',p_period_end,
      'commissionBaseSatang',v_commission_base,
      'allocatedTaxSatang',v_current_tax));
 END LOOP;
 IF v_prev_discount<>v_discount OR v_prev_tax<>v_tax
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.saas_invoice_period_claims(
  invoice_id,billing_group_id,service_start,service_end,created_by)
 VALUES(v_id,g.id,p_period_start,p_period_end,p_actor_id);
 RETURN jsonb_build_object('invoiceId',v_id,'status','draft',
   'replayed',false,'lineCount',v_count,'subtotalSatang',v_subtotal,
   'discountSatang',v_discount,'taxSatang',v_tax,'totalSatang',v_total);
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_issue_saas_invoice(
 p_actor_id uuid,p_invoice_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE i public.saas_invoices%ROWTYPE;v_lines int;v_sum bigint;v_disc bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND OR i.status NOT IN ('draft','issued')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF i.status='issued' THEN RETURN jsonb_build_object('invoiceId',i.id,
     'status','issued','replayed',true);END IF;
 SELECT count(*),coalesce(sum(amount_satang),0),
     coalesce(sum(discount_satang),0)
 INTO v_lines,v_sum,v_disc FROM public.saas_invoice_lines WHERE invoice_id=i.id;
 IF v_lines=0 OR v_sum<>i.subtotal_satang OR v_disc<>i.discount_satang
   OR i.pricing_snapshot->>'currency'<>'thb'
   OR i.pricing_snapshot->>'vatMode' NOT IN ('exclusive','inclusive')
   OR i.total_satang NOT BETWEEN 1000 AND 99999999
   OR NOT EXISTS(SELECT 1 FROM public.saas_invoice_period_claims
       WHERE invoice_id=i.id AND billing_group_id=i.billing_group_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.saas_invoices SET status='issued',
   issued_at=clock_timestamp(),due_at=clock_timestamp()+interval '7 days'
 WHERE id=i.id;
 RETURN jsonb_build_object('invoiceId',i.id,'status','issued',
   'replayed',false,'totalSatang',i.total_satang);
END $fn$;
REVOKE ALL ON FUNCTION public.platform_draft_saas_flat_invoice(
 uuid,uuid,text,date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_issue_saas_invoice(
 uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_draft_saas_flat_invoice(
 uuid,uuid,text,date,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_issue_saas_invoice(
 uuid,uuid) TO service_role;
