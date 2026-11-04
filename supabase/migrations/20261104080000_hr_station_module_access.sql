-- Production HR operations release: read-only actor-bound entitlement attestation.
-- Raw station_modules SELECT is deliberately unavailable to service_role,
-- authenticated and anon. Never grant direct table access to make HR work.
-- No mutations, wages, payment or bank activity inside this function.
CREATE OR REPLACE FUNCTION public.hr_station_module_access(
 p_actor_id uuid,p_station_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_actor_id IS NULL OR p_station_id IS NULL THEN RETURN false;END IF;
 RETURN EXISTS(
  SELECT 1 FROM public.memberships m
  JOIN public.station_modules sm ON sm.station_id=m.station_id
  WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager',
                         'cashier','attendant','pump_staff')
    AND sm.module_code='hr_payroll' AND sm.status='enabled'
 );
END $fn$;
REVOKE ALL ON FUNCTION public.hr_station_module_access(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_station_module_access(uuid,uuid)
 TO service_role;
