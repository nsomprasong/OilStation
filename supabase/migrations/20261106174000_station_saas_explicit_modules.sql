-- v2 chosen-module intent, existing read-only shell stays unchanged.
ALTER TABLE public.station_subscription_change_requests
 ADD COLUMN IF NOT EXISTS target_modules text[];
ALTER TABLE public.station_subscription_change_requests
 ADD CONSTRAINT saas_change_target_modules_valid CHECK(
  target_modules IS NULL OR
  (cardinality(target_modules) BETWEEN 1 AND 2 AND
   target_modules <@ ARRAY['hr_payroll','qr_coupon']::text[])
 );

CREATE OR REPLACE FUNCTION public.station_saas_quote_change(
 p_actor_id uuid,p_station_id uuid,p_next_plan_id uuid,p_payment_method text,
 p_target_modules text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_sub public.station_subscriptions%ROWTYPE;v_modules text[];v_quote jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=p_station_id AND m.role_code IN ('station_owner','owner'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO v_sub FROM public.station_subscriptions ss
 WHERE ss.station_id=p_station_id AND ss.status IN ('trialing','active','grace','overdue')
 ORDER BY ss.current_period_end DESC,ss.id DESC LIMIT 1;
 IF NOT FOUND OR v_sub.current_period_end<=clock_timestamp() OR
   v_sub.plan_id=p_next_plan_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_target_modules IS NULL OR cardinality(p_target_modules) NOT BETWEEN 1 AND 2
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT array_agg(DISTINCT z ORDER BY z) INTO v_modules FROM unnest(p_target_modules) z;
 IF v_modules IS DISTINCT FROM p_target_modules
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_quote:=public.station_plan_quote_for_modules(p_station_id,p_next_plan_id,p_payment_method,v_modules);
 RETURN jsonb_build_object('effectiveAt',v_sub.current_period_end,
  'currentPlanId',v_sub.plan_id,'nextPlanId',p_next_plan_id,
  'targetModules',v_modules,'quote',v_quote,
  'status','QUOTE_ONLY_NO_PAYMENT_OR_ENTITLEMENT_MUTATION');
END $fn$;

CREATE OR REPLACE FUNCTION public.station_saas_schedule_change_v2(
 p_actor_id uuid, p_station_id uuid, p_next_plan_id uuid,
 p_payment_method text, p_effective_at timestamptz, p_idempotency_key text,
 p_target_modules text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_sub public.station_subscriptions%ROWTYPE;
 v_current_frequency text;v_next_frequency text;v_quote jsonb;
 v_existing public.station_subscription_change_requests%ROWTYPE;
 v_fingerprint text;v_id uuid;v_status text;v_modules text[];
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
    AND m.station_id=p_station_id AND m.role_code IN ('station_owner','owner'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_next_plan_id IS NULL OR p_effective_at IS NULL OR
    p_payment_method NOT IN ('card','promptpay') OR
    p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 128
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 IF p_target_modules IS NULL OR cardinality(p_target_modules) NOT BETWEEN 1 AND 2 OR
  EXISTS(SELECT 1 FROM unnest(p_target_modules) AS x(code)
   WHERE x.code IS NULL OR x.code NOT IN ('qr_coupon','hr_payroll'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT array_agg(DISTINCT z ORDER BY z) INTO v_modules FROM unnest(p_target_modules) z;
 IF v_modules IS DISTINCT FROM p_target_modules
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Serialize against other requests in this station.
 PERFORM 1 FROM public.stations s WHERE s.id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_sub FROM public.station_subscriptions s
  WHERE s.station_id=p_station_id AND s.status IN ('trialing','active','grace','overdue')
  ORDER BY s.current_period_end DESC,s.id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v_sub.plan_id=p_next_plan_id OR v_sub.current_period_end<=clock_timestamp()
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 -- Release 1: only exact old end-exclusive UTC, no gap/overlap or proration.
 IF p_effective_at<>v_sub.current_period_end
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 SELECT billing_frequency INTO v_current_frequency FROM public.pricing_plans WHERE id=v_sub.plan_id;
 SELECT billing_frequency INTO v_next_frequency FROM public.pricing_plans
  WHERE id=p_next_plan_id AND active;
 IF v_next_frequency IS NULL OR v_current_frequency IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 v_fingerprint:=jsonb_build_object('stationId',p_station_id,'subscriptionId',v_sub.id,
    'oldPlanId',v_sub.plan_id,'nextPlanId',p_next_plan_id,
    'paymentMethod',p_payment_method,'effectiveAt',p_effective_at,
    'targetModules',to_jsonb(v_modules))::text;
 SELECT * INTO v_existing FROM public.station_subscription_change_requests
  WHERE station_id=p_station_id AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.request_fingerprint<>v_fingerprint
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('changeId',v_existing.id,'status',v_existing.status,
   'paymentStatus',v_existing.payment_status,'effectiveAt',v_existing.requested_effective_at,
   'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.station_subscription_change_requests
   WHERE station_id=p_station_id AND status='pending')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 v_quote:=public.station_plan_quote_for_modules(p_station_id,p_next_plan_id,p_payment_method,v_modules);
 INSERT INTO public.station_subscription_change_requests(
  station_id,requested_by,current_subscription_id,current_plan_id,next_plan_id,
  old_period_end_snapshot,requested_effective_at,renewal_anchor_day,
  idempotency_key,request_fingerprint,price_snapshot,status,payment_status,target_modules)
 VALUES (p_station_id,p_actor_id,v_sub.id,v_sub.plan_id,p_next_plan_id,
  v_sub.current_period_end,p_effective_at,extract(day from v_sub.starts_at at time zone 'UTC')::integer,
  p_idempotency_key,v_fingerprint,v_quote,'pending','unconfirmed',v_modules)
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('changeId',v_id,'status','pending',
  'paymentStatus','unconfirmed','effectiveAt',p_effective_at,'replayed',false);
END $fn$;


REVOKE ALL ON FUNCTION public.station_saas_quote_change(uuid,uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_saas_schedule_change_v2(uuid,uuid,uuid,text,timestamptz,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_saas_quote_change(uuid,uuid,uuid,text,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_saas_schedule_change_v2(uuid,uuid,uuid,text,timestamptz,text,text[]) TO service_role;
-- Prevent old no-module API from bypassing the new explicit entitlement contract.
REVOKE EXECUTE ON FUNCTION public.station_saas_schedule_change(uuid,uuid,uuid,text,timestamptz,text) FROM service_role;
