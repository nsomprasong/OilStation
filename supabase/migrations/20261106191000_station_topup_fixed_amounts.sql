-- Station-defined fixed top-up choices. A corporate payer never submits free-form amounts.
CREATE TABLE IF NOT EXISTS public.station_topup_amount_options(
 station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
 amount_satang bigint NOT NULL CHECK(amount_satang BETWEEN 100 AND 100000000000),
 PRIMARY KEY(station_id,amount_satang)
);
ALTER TABLE public.station_topup_amount_options ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.station_topup_amount_options FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON TABLE public.station_topup_amount_options TO service_role;

CREATE OR REPLACE FUNCTION public.station_set_topup_amount_options(
 p_actor_id uuid,p_station_id uuid,p_amounts bigint[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_amounts bigint[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
     AND m.station_id=p_station_id AND
      (m.role_code IN ('station_owner','owner','manager')
       OR m.extra_permissions->>'manage_bank_accounts'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_amounts IS NULL OR cardinality(p_amounts) NOT BETWEEN 1 AND 8
   OR EXISTS(SELECT 1 FROM unnest(p_amounts) x WHERE x IS NULL OR x<100 OR x>100000000000)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT array_agg(DISTINCT x ORDER BY x) INTO v_amounts FROM unnest(p_amounts) x;
 IF cardinality(v_amounts)<>cardinality(p_amounts)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 PERFORM 1 FROM public.stations s WHERE s.id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 DELETE FROM public.station_topup_amount_options WHERE station_id=p_station_id;
 INSERT INTO public.station_topup_amount_options(station_id,amount_satang)
  SELECT p_station_id,x FROM unnest(v_amounts) x;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'station_topup_options',p_station_id::text,
  'topup_amount_options_changed',jsonb_build_object('amounts',to_jsonb(v_amounts)));
 RETURN jsonb_build_object('amounts',to_jsonb(v_amounts),'saved',true);
END $fn$;

CREATE OR REPLACE FUNCTION public.station_get_topup_amount_options(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
    AND m.station_id=p_station_id AND
    (m.role_code IN ('station_owner','owner','manager')
     OR m.extra_permissions->>'manage_bank_accounts'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(o.amount_satang::text ORDER BY o.amount_satang),'[]'::jsonb)
  INTO v_result FROM public.station_topup_amount_options o WHERE o.station_id=p_station_id;
 RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.corporate_topup_amount_options(
 p_actor_id uuid,p_account_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station uuid;v_company uuid;v_result jsonb;
BEGIN
 SELECT a.station_id,a.company_id INTO v_station,v_company
 FROM public.corporate_station_accounts a WHERE a.id=p_account_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
    AND m.corporate_company_id=v_company AND
    (m.role_code IN ('corporate_admin','accountant','finance_manager')
      OR m.extra_permissions->>'request_topup'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(o.amount_satang::text ORDER BY o.amount_satang),'[]'::jsonb)
 INTO v_result FROM public.station_topup_amount_options o WHERE o.station_id=v_station;
 RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.authorize_corporate_topup_preset_upload(
 p_actor_id uuid,p_account_id uuid,p_station_bank_id uuid,p_amount_satang bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station uuid;
BEGIN
 PERFORM public.authorize_corporate_topup_upload(
  p_actor_id,p_account_id,p_station_bank_id,p_amount_satang);
 SELECT station_id INTO v_station FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT EXISTS(SELECT 1 FROM public.station_topup_amount_options o
  WHERE o.station_id=v_station AND o.amount_satang=p_amount_satang)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN jsonb_build_object('authorized',true);
END $fn$;

-- Enforce preset at request insertion too, so direct legacy RPC calls cannot bypass amount policy.
CREATE OR REPLACE FUNCTION public.station_topup_request_preset_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station uuid;
BEGIN
 SELECT station_id INTO v_station FROM public.corporate_station_accounts WHERE id=NEW.account_id;
 IF NOT EXISTS(SELECT 1 FROM public.station_topup_amount_options o
  WHERE o.station_id=v_station AND o.amount_satang=NEW.amount_satang)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS station_topup_request_preset_guard ON public.topup_requests;
CREATE TRIGGER station_topup_request_preset_guard BEFORE INSERT ON public.topup_requests
 FOR EACH ROW EXECUTE FUNCTION public.station_topup_request_preset_guard();

REVOKE ALL ON FUNCTION public.station_set_topup_amount_options(uuid,uuid,bigint[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_get_topup_amount_options(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.corporate_topup_amount_options(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.authorize_corporate_topup_preset_upload(uuid,uuid,uuid,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_topup_request_preset_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_set_topup_amount_options(uuid,uuid,bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_get_topup_amount_options(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.corporate_topup_amount_options(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.authorize_corporate_topup_preset_upload(uuid,uuid,uuid,bigint) TO service_role;
