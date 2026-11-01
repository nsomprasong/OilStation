-- Read-only, station-scoped setup view for HR account-link and geofence UI.
-- No payroll wages, email addresses, phone numbers or raw credentials returned.
CREATE OR REPLACE FUNCTION public.hr_station_link_setup(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_employees jsonb;v_accounts jsonb;v_geofence jsonb;
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM public.memberships m
   JOIN public.station_modules sm ON sm.station_id=m.station_id
   WHERE m.user_id=p_actor_id AND m.scope_type='station'
     AND m.station_id=p_station_id AND m.active
     AND m.role_code IN ('station_owner','owner','manager','hr_manager')
     AND sm.module_code='hr_payroll' AND sm.status='enabled'
 ) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;

 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',e.id,'name',e.display_name,'code',e.employee_code,
  'linked',e.user_id IS NOT NULL) ORDER BY e.display_name,e.id),'[]'::jsonb)
 INTO v_employees
 FROM public.employees e WHERE e.station_id=p_station_id
   AND e.employment_status='active';

 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'userId',x.id,'name',x.display_name,'role',x.role_code)
   ORDER BY x.display_name,x.id),'[]'::jsonb)
 INTO v_accounts
 FROM (
   SELECT DISTINCT ON (u.id) u.id,
    COALESCE(NULLIF(BTRIM(u.display_name),''),'บัญชีพนักงาน') AS display_name,
    m.role_code
   FROM public.memberships m
   JOIN public.app_users u ON u.id=m.user_id
   WHERE m.scope_type='station' AND m.station_id=p_station_id AND m.active
    AND u.status='active'
    AND m.role_code IN ('cashier','attendant','pump_staff')
    AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=u.id)
   ORDER BY u.id,m.role_code
   LIMIT 100
 ) x;

 SELECT jsonb_build_object('configured',g.station_id IS NOT NULL,
   'latitude',s.latitude,'longitude',s.longitude,
   'radiusMeters',g.radius_m,'maxAccuracyMeters',g.max_accuracy_m)
 INTO v_geofence
 FROM public.stations s
 LEFT JOIN public.station_geofence_settings g ON g.station_id=s.id
 WHERE s.id=p_station_id;

 RETURN jsonb_build_object('employees',v_employees,'accounts',v_accounts,
   'geofence',v_geofence);
END $fn$;
REVOKE ALL ON FUNCTION public.hr_station_link_setup(uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_station_link_setup(uuid,uuid) TO service_role;
