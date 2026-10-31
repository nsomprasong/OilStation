-- Read-only, service-role RPC. QA Support sees only four explicitly approved stations.
CREATE OR REPLACE FUNCTION public.platform_support_overview(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_allowed boolean; v_qa boolean; v_stations jsonb; v_events jsonb;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
 AND m.active AND m.scope_type='platform'
 AND m.role_code IN ('platform_support','platform_superadmin')) INTO v_allowed;
 IF NOT v_allowed THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_actor_id
 AND u.raw_app_meta_data->>'oilstation_qa'='true'
 AND u.raw_app_meta_data->>'oilstation_qa_run_id'='QA-20261031-PLATFORM-001') INTO v_qa;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'status',s.status)
 ORDER BY s.name),'[]'::jsonb) INTO v_stations
 FROM (SELECT s.id,s.name,s.status FROM public.stations s
 WHERE NOT v_qa OR s.name IN ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B')
 ORDER BY s.name LIMIT 200) s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('station',e.station,'action',e.action,'at',e.created_at)
 ORDER BY e.created_at DESC),'[]'::jsonb) INTO v_events
 FROM (SELECT s.name AS station,a.action,a.created_at FROM public.audit_events a
 JOIN public.stations s ON s.id=a.station_id
 WHERE (NOT v_qa OR s.name IN ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'))
 AND a.action IN ('sales_station_created','station_created','fuel_pricing_updated','sales_care_transfer')
 ORDER BY a.created_at DESC LIMIT 40) e;
 RETURN jsonb_build_object('readOnly',true,'qaScope',v_qa,'stations',v_stations,'activity',v_events);
END $fn$;
REVOKE ALL ON FUNCTION public.platform_support_overview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_support_overview(uuid) TO service_role;
