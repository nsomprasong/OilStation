-- Sales self-onboarding writes audit_events(entity_type='station',action='sales_station_created').
-- The original read-only activity RPC recognized only station_created, so
-- the four real QA creations were missing from Sales' "who did what" history.
-- Preserve existing authorization, scoped station filter, pagination and
-- allowlist; never expose sensitive audit JSON differences or financial actions.
CREATE OR REPLACE FUNCTION public.platform_sales_activity_history(
 p_actor_id uuid,p_station_id uuid,p_before timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_allowed boolean;v_rows jsonb;
BEGIN
 SELECT (EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.scope_type='platform' AND m.role_code='platform_superadmin' AND m.active)
  OR EXISTS(SELECT 1 FROM public.memberships m
   JOIN public.sales_assignments a ON a.sales_user_id=m.user_id
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='platform'
    AND m.role_code='platform_sales' AND a.station_id=p_station_id
    AND a.effective_from<=clock_timestamp()
    AND (a.effective_until IS NULL OR a.effective_until>clock_timestamp())))
 INTO v_allowed;
 IF NOT v_allowed THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'who',
   coalesce(nullif(btrim(u.display_name),''),u.email,'ผู้ใช้งานระบบ'),
   'what',CASE
      WHEN a.entity_type='station' AND a.action IN ('station_created','sales_station_created') THEN 'สร้างปั๊มน้ำมัน'
      WHEN a.entity_type='station_fuel' AND a.action='fuel_pricing_updated' THEN 'ปรับปรุงข้อมูลน้ำมัน'
      WHEN a.entity_type='invitation' AND a.action='invite_created' THEN 'สร้างคำเชิญสมาชิก'
      WHEN a.entity_type='invitation' AND a.action='accepted' THEN 'ตอบรับคำเชิญ'
      WHEN a.entity_type='sales_assignment' AND a.action='sales_care_transfer' THEN 'ย้ายผู้ดูแลปั๊มน้ำมัน'
      ELSE 'ปรับปรุงข้อมูลการดำเนินงาน' END,
   'at',a.created_at) ORDER BY a.created_at DESC,a.id DESC),'[]'::jsonb)
 INTO v_rows
 FROM (
  SELECT e.id,e.actor_id,e.entity_type,e.action,e.created_at
  FROM public.audit_events e
  WHERE e.station_id=p_station_id
   AND (p_before IS NULL OR e.created_at<p_before)
   AND ((e.entity_type='station' AND e.action IN ('station_created','sales_station_created'))
    OR (e.entity_type='station_fuel' AND e.action='fuel_pricing_updated')
    OR (e.entity_type='invitation' AND e.action IN ('invite_created','accepted'))
    OR (e.entity_type='sales_assignment' AND e.action='sales_care_transfer'))
  ORDER BY e.created_at DESC,e.id DESC LIMIT 50
 ) a LEFT JOIN public.app_users u ON u.id=a.actor_id;
 RETURN jsonb_build_object('stationId',p_station_id,'events',v_rows,'readOnly',true);
END $fn$;

REVOKE ALL ON FUNCTION public.platform_sales_station_inspection(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_sales_station_inspection(uuid,uuid,uuid)
 TO service_role;
REVOKE ALL ON FUNCTION public.platform_sales_activity_history(uuid,uuid,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_sales_activity_history(uuid,uuid,timestamptz)
 TO service_role;
