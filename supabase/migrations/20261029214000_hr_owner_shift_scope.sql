-- Forward-only alignment: production had the earlier 20261029144000 migration.
-- Do not reapply historical DDL. Organizational owners can create shifts for
-- THEIR OWN stations only, matching hr_station_roster and hr_add_employee.
-- No access to unrelated organizations or to unrelated staff.
CREATE OR REPLACE FUNCTION public.hr_seed_shift_templates(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='station' AND m.station_id=p_station_id
     AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
   OR (m.scope_type='organization' AND m.organization_id=
    (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
    AND m.role_code IN ('organization_owner','owner'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.station_modules WHERE station_id=p_station_id
   AND module_code='hr_payroll' AND status='enabled') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 INSERT INTO public.shift_templates(station_id,name,start_time,end_time,default_break_minutes)
 SELECT p_station_id, x.name, x.begins,x.ends,0 FROM (VALUES
  ('กะเช้า','06:00'::time,'14:00'::time),
  ('กะบ่าย','14:00'::time,'22:00'::time),
  ('กะดึก','22:00'::time,'06:00'::time)
 ) AS x(name,begins,ends)
 WHERE NOT EXISTS(SELECT 1 FROM public.shift_templates t
   WHERE t.station_id=p_station_id AND t.name=x.name);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('created',v_count);
END $f$;
CREATE OR REPLACE FUNCTION public.hr_assign_shift(
 p_actor_id uuid,p_employee_id uuid,p_template_id uuid,p_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_station uuid;v_template_station uuid;v_id uuid:=gen_random_uuid();
BEGIN
 SELECT station_id INTO v_station FROM public.employees
  WHERE id=p_employee_id AND employment_status='active';
 SELECT station_id INTO v_template_station FROM public.shift_templates
  WHERE id=p_template_id AND active;
 IF v_station IS NULL OR v_template_station IS NULL
    OR v_station<>v_template_station OR p_date IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='station' AND m.station_id=v_station
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
   OR (m.scope_type='organization' AND m.organization_id=
    (SELECT s.organization_id FROM public.stations s WHERE s.id=v_station)
    AND m.role_code IN ('organization_owner','owner'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_date<current_date-30 OR p_date>current_date+365 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_SHIFT_DATE';END IF;
 INSERT INTO public.shift_assignments(id,employee_id,shift_template_id,shift_date,status)
 VALUES(v_id,p_employee_id,p_template_id,p_date,'scheduled')
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN
   SELECT id INTO v_id FROM public.shift_assignments
   WHERE employee_id=p_employee_id AND shift_template_id=p_template_id
     AND shift_date=p_date AND status<>'cancelled' LIMIT 1;
 END IF;
 RETURN jsonb_build_object('id',v_id,'employeeId',p_employee_id,
   'shiftDate',p_date,'templateId',p_template_id);
END $f$;
REVOKE ALL ON FUNCTION public.hr_seed_shift_templates(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_assign_shift(uuid,uuid,uuid,date)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_seed_shift_templates(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_assign_shift(uuid,uuid,uuid,date) TO service_role;
