-- Invited station owner chooses a SaaS plan and payment method AFTER
-- accepting the station-owner invitation. This never charges funds.
CREATE TABLE IF NOT EXISTS public.station_plan_checkout_requests (
 station_id uuid PRIMARY KEY REFERENCES public.stations(id),
 plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
 payment_method text NOT NULL CHECK(payment_method IN ('card','promptpay')),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 amount_satang bigint NOT NULL CHECK(amount_satang BETWEEN 1000 AND 99999999),
 pricing_snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending_payment' CHECK(status='pending_payment'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.station_plan_checkout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_plan_checkout_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_plan_checkout_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.station_plan_pricing(
 p_station_id uuid,p_plan_id uuid,p_method text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_modules integer;
 v_covered integer;
 v_subtotal bigint;
 v_coupon bigint;
 v_hr bigint;
 v_vat_mode text;
 v_rate integer;
 v_discount bigint;
 v_net bigint;
 v_tax bigint;
 v_total bigint;
BEGIN
 IF p_method NOT IN ('card','promptpay') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pricing_plans p
   WHERE p.id=p_plan_id AND p.active) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT count(*) INTO v_modules FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.status='enabled';
 IF v_modules=0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 WITH priced AS (
  SELECT sm.module_code,
    (SELECT pr.price_satang FROM public.pricing_rules pr
      WHERE pr.plan_id=p_plan_id AND pr.module_code=sm.module_code
       AND pr.billing_method='flat'
       AND pr.effective_at<=clock_timestamp()
       AND (pr.expires_at IS NULL OR pr.expires_at>clock_timestamp())
      ORDER BY pr.effective_at DESC,pr.id DESC LIMIT 1) price
  FROM public.station_modules sm
  WHERE sm.station_id=p_station_id AND sm.status='enabled'
 )
 SELECT count(price),coalesce(sum(price),0),
    coalesce(sum(price) FILTER(WHERE module_code='qr_coupon'),0),
    coalesce(sum(price) FILTER(WHERE module_code='hr_payroll'),0)
 INTO v_covered,v_subtotal,v_coupon,v_hr FROM priced;
 IF v_covered<>v_modules OR v_subtotal NOT BETWEEN 1000 AND 99999999
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRICE_RULE_UNAVAILABLE';END IF;
 SELECT vat_mode,rate_basis_points INTO v_vat_mode,v_rate
 FROM public.saas_tax_review_policies
 WHERE effective_on<=CURRENT_DATE
 ORDER BY effective_on DESC,approved_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='TAX_POLICY_REQUIRED';
 END IF;
 v_discount:=CASE WHEN p_method='promptpay' THEN round(v_subtotal::numeric*2/100)::bigint ELSE 0 END;
 v_net:=v_subtotal-v_discount;
 v_tax:=CASE WHEN v_vat_mode='exclusive'
   THEN round(v_net::numeric*v_rate/10000)::bigint
   ELSE round(v_net::numeric*v_rate/(10000+v_rate))::bigint END;
 v_total:=CASE WHEN v_vat_mode='exclusive' THEN v_net+v_tax ELSE v_net END;
 RETURN jsonb_build_object('subtotalSatang',v_subtotal,'couponSatang',v_coupon,
   'hrSatang',v_hr,'discountSatang',v_discount,'taxSatang',v_tax,
   'totalSatang',v_total,'vatMode',v_vat_mode,'rateBasisPoints',v_rate,
   'paymentMethod',p_method,'planId',p_plan_id);
END $fn$;

CREATE OR REPLACE FUNCTION public.station_saas_plan_options(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_plans jsonb;v_station text;v_selected jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE
    m.user_id=p_actor_id AND m.active AND m.scope_type='station'
    AND m.station_id=p_station_id AND m.role_code IN ('station_owner','owner'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT name INTO v_station FROM public.stations WHERE id=p_station_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name,
    'frequency',p.billing_frequency,'card',public.station_plan_pricing(p_station_id,p.id,'card'),
    'promptpay',public.station_plan_pricing(p_station_id,p.id,'promptpay'))
    ORDER BY p.created_at DESC),'[]'::jsonb)
 INTO v_plans
 FROM public.pricing_plans p
 WHERE p.active AND EXISTS(SELECT 1 FROM public.pricing_rules r
   WHERE r.plan_id=p.id AND r.billing_method='flat' AND r.effective_at<=clock_timestamp());
 SELECT jsonb_build_object('planId',c.plan_id,'paymentMethod',c.payment_method,
   'amountSatang',c.amount_satang,'status',c.status,'updatedAt',c.updated_at)
 INTO v_selected FROM public.station_plan_checkout_requests c
 WHERE c.station_id=p_station_id;
 RETURN jsonb_build_object('stationName',v_station,'plans',v_plans,'selected',v_selected);
END $fn$;

CREATE OR REPLACE FUNCTION public.station_select_saas_plan(
 p_actor_id uuid,p_station_id uuid,p_plan_id uuid,p_payment_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_quote jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE
    m.user_id=p_actor_id AND m.active AND m.scope_type='station'
    AND m.station_id=p_station_id AND m.role_code IN ('station_owner','owner'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 PERFORM 1 FROM public.stations s WHERE s.id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF EXISTS(SELECT 1 FROM public.station_subscriptions s
   WHERE s.station_id=p_station_id AND s.status IN ('trialing','active','grace','overdue'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_quote:=public.station_plan_pricing(p_station_id,p_plan_id,p_payment_method);
 INSERT INTO public.station_plan_checkout_requests(
  station_id,plan_id,payment_method,actor_id,amount_satang,pricing_snapshot,
  status,updated_at
 ) VALUES (p_station_id,p_plan_id,p_payment_method,p_actor_id,
  (v_quote->>'totalSatang')::bigint,v_quote,'pending_payment',clock_timestamp())
 ON CONFLICT(station_id) DO UPDATE
 SET plan_id=excluded.plan_id,payment_method=excluded.payment_method,
    actor_id=excluded.actor_id,amount_satang=excluded.amount_satang,
    pricing_snapshot=excluded.pricing_snapshot,status='pending_payment',
    updated_at=clock_timestamp();
 RETURN jsonb_build_object('stationId',p_station_id,'status','pending_payment',
  'amountSatang',(v_quote->>'totalSatang')::bigint,'paymentMethod',p_payment_method,
  'planId',p_plan_id);
END $fn$;

REVOKE ALL ON FUNCTION public.station_plan_pricing(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_saas_plan_options(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_select_saas_plan(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_plan_pricing(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_saas_plan_options(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_select_saas_plan(uuid,uuid,uuid,text) TO service_role;
