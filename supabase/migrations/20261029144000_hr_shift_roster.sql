-- Minimal functional HR roster and shift scheduling. Attendance, biometric
-- verification and paid OT require separate explicit approval workflows.
CREATE UNIQUE INDEX IF NOT EXISTS shift_assignments_employee_template_day
 ON public.shift_assignments(employee_id,shift_template_id,shift_date)
 WHERE status<>'cancelled';

CREATE OR REPLACE FUNCTION public.hr_station_roster(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND (
    (m.scope_type='platform' AND m.role_code='platform_superadmin')
    OR (m.scope_type='station' AND m.station_id=p_station_id
       AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR (m.scope_type='organization' AND m.organization_id=
      (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
      AND m.role_code IN ('organization_owner','owner'))
 )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT jsonb_build_object(
  'employees',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'code',e.employee_code,'name',e.display_name,
    'employmentStatus',e.employment_status,'wageType',e.wage_type,
    'payrollFrequency',e.payroll_frequency) ORDER BY e.display_name),'[]'::jsonb)
    FROM public.employees e WHERE e.station_id=p_station_id),
  'shiftTemplates',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'startsAt',t.start_time::text,
    'endsAt',t.end_time::text,'breakMinutes',t.default_break_minutes)
    ORDER BY t.start_time),'[]'::jsonb)
    FROM public.shift_templates t WHERE t.station_id=p_station_id AND t.active),
  'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'employeeId',a.employee_id,'templateId',a.shift_template_id,
    'date',a.shift_date,'status',a.status) ORDER BY a.shift_date),'[]'::jsonb)
    FROM public.shift_assignments a
    JOIN public.employees e ON e.id=a.employee_id
    WHERE e.station_id=p_station_id AND a.shift_date>=current_date-7
      AND a.shift_date<=current_date+31)
 ) INTO result;
 RETURN result;
END $f$;

CREATE OR REPLACE FUNCTION public.hr_add_employee(
 p_actor_id uuid,p_station_id uuid,p_employee_code text,p_name text,
 p_wage_type text,p_wage_satang bigint,p_payroll_frequency text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.station_modules sm
   WHERE sm.station_id=p_station_id AND sm.module_code='hr_payroll'
    AND sm.status='enabled') THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='HR_MODULE_DISABLED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
  OR (m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
  OR (m.scope_type='organization' AND m.organization_id=
   (SELECT s.organization_id FROM public.stations s WHERE s.id=p_station_id)
   AND m.role_code IN ('organization_owner','owner'))))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_employee_code IS NULL OR length(btrim(p_employee_code)) NOT BETWEEN 1 AND 40
  OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 200
  OR p_wage_type NOT IN ('monthly','daily','hourly')
  OR p_wage_satang IS NULL OR p_wage_satang<0
  OR p_payroll_frequency NOT IN ('weekly','semi_monthly','monthly') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.employees(id,station_id,employee_code,display_name,
  employment_status,wage_type,wage_satang,payroll_frequency)
 VALUES(v_id,p_station_id,btrim(p_employee_code),btrim(p_name),'active',
  p_wage_type,p_wage_satang,p_payroll_frequency);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,p_station_id,'employee',v_id::text,'employee_created');
 RETURN jsonb_build_object('id',v_id,'name',btrim(p_name),'stationId',p_station_id);
END $f$;

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
     AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
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
    AND m.role_code IN ('station_owner','owner','manager','hr_manager'))))
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

DO $grants$ BEGIN
  REVOKE ALL ON FUNCTION public.hr_station_roster(uuid,uuid) FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON FUNCTION public.hr_add_employee(uuid,uuid,text,text,text,bigint,text)
  FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON FUNCTION public.hr_seed_shift_templates(uuid,uuid) FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON FUNCTION public.hr_assign_shift(uuid,uuid,uuid,date) FROM PUBLIC,anon,authenticated;
  GRANT EXECUTE ON FUNCTION public.hr_station_roster(uuid,uuid) TO service_role;
  GRANT EXECUTE ON FUNCTION public.hr_add_employee(uuid,uuid,text,text,text,bigint,text) TO service_role;
  GRANT EXECUTE ON FUNCTION public.hr_seed_shift_templates(uuid,uuid) TO service_role;
  GRANT EXECUTE ON FUNCTION public.hr_assign_shift(uuid,uuid,uuid,date) TO service_role;
END $grants$;
