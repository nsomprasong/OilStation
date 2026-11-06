-- Read-only owner subscription snapshot for truthful SaaS change UAT.
-- Does not schedule, charge, extend, transition or mutate any subscription.
CREATE OR REPLACE FUNCTION public.station_saas_plan_options(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_plans jsonb;v_station text;v_selected jsonb;v_subscription jsonb;
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
 -- Owner-only read of existing term; never leak it to unrelated station roles.
 SELECT jsonb_build_object('planId',s.plan_id,'planName',p.name,
   'frequency',p.billing_frequency,'status',s.status,
   'startsAt',s.starts_at,'periodEnd',s.current_period_end)
 INTO v_subscription
 FROM public.station_subscriptions s
 JOIN public.pricing_plans p ON p.id=s.plan_id
 WHERE s.station_id=p_station_id
 ORDER BY CASE WHEN s.status IN ('trialing','active','grace','overdue') THEN 0 ELSE 1 END,
   s.current_period_end DESC,s.id DESC
 LIMIT 1;
 RETURN jsonb_build_object('stationName',v_station,'plans',v_plans,
   'selected',v_selected,'subscription',v_subscription);
END $fn$;
REVOKE ALL ON FUNCTION public.station_saas_plan_options(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_saas_plan_options(uuid,uuid) TO service_role;
