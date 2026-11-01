-- Forward-only HR controls: link an existing employee to an existing station user.
-- All writes are server-service RPCs with independent actor/station checks.
-- Does not provision auth accounts, create new employees or approve payroll.
CREATE UNIQUE INDEX IF NOT EXISTS employees_one_login_per_employee
  ON public.employees(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.hr_link_existing_station_employee(
 p_actor_id uuid,p_station_id uuid,p_employee_id uuid,p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.employees%ROWTYPE;
BEGIN
 IF p_actor_id IS NULL OR p_station_id IS NULL OR p_employee_id IS NULL OR
    p_user_id IS NULL OR p_actor_id=p_user_id THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.module_code='hr_payroll'
     AND sm.status='enabled'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.scope_type='station'
     AND m.station_id=p_station_id AND m.active
     AND m.role_code IN ('station_owner','owner','manager','hr_manager')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 -- A station employee must have their own active station login; no cross-tenant,
 -- billing, platform, corporate-only or owner/manager accounts can be attached.
 IF NOT EXISTS (
   SELECT 1 FROM public.app_users u JOIN public.memberships m ON m.user_id=u.id
   WHERE u.id=p_user_id AND u.status='active' AND m.active
     AND m.scope_type='station' AND m.station_id=p_station_id
     AND m.role_code IN ('cashier','attendant','pump_staff')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO e FROM public.employees
   WHERE id=p_employee_id AND station_id=p_station_id
     AND employment_status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF e.user_id IS NOT NULL THEN
   IF e.user_id=p_user_id THEN
     RETURN jsonb_build_object('employeeId',e.id,'stationId',p_station_id,
       'userId',p_user_id,'replayed',true);
   END IF;
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_LINKED';
 END IF;
 IF EXISTS (SELECT 1 FROM public.employees other WHERE other.user_id=p_user_id) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_LINKED';
 END IF;
 UPDATE public.employees SET user_id=p_user_id WHERE id=e.id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,
    before_state,after_state)
 VALUES(p_actor_id,p_station_id,'employee',e.id::text,'employee_login_linked',
    jsonb_build_object('userId',null),
    jsonb_build_object('userId',p_user_id));
 RETURN jsonb_build_object('employeeId',e.id,'stationId',p_station_id,
     'userId',p_user_id,'replayed',false);
END $fn$;

-- A reviewed configuration route with an audit record; the original
-- station-scoped geo RPC still validates coordinates, radius and reviewer.
CREATE OR REPLACE FUNCTION public.hr_configure_station_geofence_audited(
 p_actor_id uuid,p_station_id uuid,p_latitude numeric,p_longitude numeric,
 p_radius_m integer,p_accuracy_m integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE before_geo jsonb;result jsonb;
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.module_code='hr_payroll'
     AND sm.status='enabled'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 SELECT jsonb_build_object('latitude',s.latitude,'longitude',s.longitude,
   'radiusMeters',g.radius_m,'maxAccuracyMeters',g.max_accuracy_m)
 INTO before_geo FROM public.stations s
 LEFT JOIN public.station_geofence_settings g ON g.station_id=s.id
 WHERE s.id=p_station_id;
 -- The existing routine validates all fields and membership, not the browser.
 result:=public.hr_configure_station_geofence(
  p_actor_id,p_station_id,p_latitude,p_longitude,p_radius_m,p_accuracy_m);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,
   before_state,after_state)
 VALUES(p_actor_id,p_station_id,'station_geofence',p_station_id::text,
   'station_geofence_configured',before_geo,
   jsonb_build_object('latitude',p_latitude,'longitude',p_longitude,
     'radiusMeters',p_radius_m,'maxAccuracyMeters',p_accuracy_m));
 RETURN result;
END $fn$;

REVOKE ALL ON FUNCTION public.hr_link_existing_station_employee(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_configure_station_geofence_audited(uuid,uuid,numeric,numeric,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_link_existing_station_employee(uuid,uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_configure_station_geofence_audited(uuid,uuid,numeric,numeric,integer,integer)
 TO service_role;
