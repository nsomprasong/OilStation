-- Production-safe, permission-scoped read views and soft membership actions.
-- Never increments credit directly. Top-ups continue through slip/bank review.
BEGIN;

CREATE OR REPLACE FUNCTION public.oilstation_station_customer_overview(
 p_actor_id uuid,p_station_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_station_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='station' AND m.station_id=p_station_id
   AND m.role_code IN ('station_owner','owner','manager','finance_manager','cashier')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'accountId',a.id,'companyId',a.company_id,'companyName',c.name,
  'prepaidSatang',a.prepaid_balance_satang::text,
  'creditLimitSatang',a.credit_limit_satang::text,
  'debtSatang',a.debt_outstanding_satang::text,
  'reservedSatang',a.reserved_satang::text,
  'availableSatang',GREATEST(0::numeric,
    a.prepaid_balance_satang::numeric+a.credit_limit_satang::numeric
    -a.debt_outstanding_satang::numeric-a.reserved_satang::numeric)::text,
  'pendingTopupSatang',COALESCE((SELECT SUM(t.amount_satang)
   FROM public.topup_requests t WHERE t.account_id=a.id AND t.status='pending'),0)::text
 ) ORDER BY c.name,a.id),'[]'::jsonb) INTO v_result
 FROM public.corporate_station_accounts a JOIN public.corporate_companies c
  ON c.id=a.company_id AND c.status='active'
 WHERE a.station_id=p_station_id;
 RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_fuel_report_by_plate(
 p_actor_id uuid,p_station_id uuid,p_company_id uuid DEFAULT NULL,
 p_plate text DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_station_id IS NULL OR p_limit NOT BETWEEN 1 AND 200
    OR LENGTH(COALESCE(p_plate,''))>40
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND ((m.scope_type='station' AND m.station_id=p_station_id
      AND m.role_code IN ('station_owner','owner','manager','finance_manager','cashier'))
      OR (p_company_id IS NOT NULL AND m.scope_type='corporate_company'
      AND m.corporate_company_id=p_company_id
      AND m.role_code IN ('corporate_admin','accountant','finance_manager','coupon_issuer')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',r.id,'companyName',r.company_name,'plate',r.plate,
  'date',r.finished_at,'liters',r.liters::text,
  'amountSatang',r.net_amount_satang::text,'fuel',r.fuel_name
 ) ORDER BY r.finished_at DESC,r.id DESC),'[]'::jsonb) INTO v_result
 FROM (
  SELECT fs.id,co.name AS company_name,
   COALESCE(NULLIF(btrim(c.plate_snapshot),''),cv.plate_number,'ไม่ระบุ') AS plate,
   fs.finished_at,fs.liters,fs.net_amount_satang,
   COALESCE(NULLIF(fp.name_override,''),NULLIF(fp.custom_name,''),bp.name_th,'น้ำมัน') AS fuel_name
  FROM public.fuel_sessions fs JOIN public.coupons c ON c.id=fs.coupon_id
  JOIN public.corporate_station_accounts a ON a.id=c.account_id AND a.station_id=fs.station_id
  JOIN public.corporate_companies co ON co.id=a.company_id
  LEFT JOIN public.corporate_vehicles cv ON cv.id=c.vehicle_id
  LEFT JOIN public.station_fuel_products fp ON fp.id=fs.station_fuel_id
  LEFT JOIN public.brand_fuel_products bp ON bp.id=fp.brand_product_id
  WHERE fs.station_id=p_station_id AND fs.status='completed'
   AND fs.finished_at IS NOT NULL
   AND (p_company_id IS NULL OR a.company_id=p_company_id)
   AND (NULLIF(btrim(COALESCE(p_plate,'')),'') IS NULL
     OR upper(COALESCE(NULLIF(btrim(c.plate_snapshot),''),cv.plate_number,''))=upper(btrim(p_plate)))
  ORDER BY fs.finished_at DESC,fs.id DESC LIMIT p_limit
 ) r;
 RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_scoped_member_directory(
 p_actor_id uuid,p_scope_type text,p_scope_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF p_scope_id IS NULL OR p_scope_type NOT IN ('station','corporate_company')
    OR NOT EXISTS(
      SELECT 1 FROM public.memberships a WHERE a.user_id=p_actor_id AND a.active
      AND ((p_scope_type='station' AND a.scope_type='station'
       AND a.station_id=p_scope_id AND a.role_code IN ('station_owner','owner','manager'))
      OR (p_scope_type='corporate_company' AND a.scope_type='corporate_company'
       AND a.corporate_company_id=p_scope_id AND a.role_code='corporate_admin'))
    )
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'membershipId',m.id,'userId',m.user_id,'displayName',COALESCE(NULLIF(u.display_name,''),u.email),
  'email',u.email,'role',m.role_code,'active',m.active,'joinedAt',m.created_at
 ) ORDER BY m.active DESC,u.display_name,u.email,m.id),'[]'::jsonb)
 INTO v_result FROM public.memberships m JOIN public.app_users u ON u.id=m.user_id
 WHERE m.scope_type=p_scope_type AND
  ((p_scope_type='station' AND m.station_id=p_scope_id) OR
   (p_scope_type='corporate_company' AND m.corporate_company_id=p_scope_id));
 RETURN v_result;
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_scoped_member_change(
 p_actor_id uuid,p_membership_id uuid,p_action text,p_role_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_m public.memberships%ROWTYPE;v_roles text[];v_scope uuid;
BEGIN
 SELECT * INTO v_m FROM public.memberships m
 WHERE m.id=p_membership_id AND m.active FOR UPDATE;
 IF NOT FOUND OR p_actor_id IS NULL OR p_actor_id=v_m.user_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF v_m.scope_type='station' THEN
  v_scope:=v_m.station_id;
  v_roles:=ARRAY['manager','cashier','attendant','pump_staff','hr_manager','finance_manager'];
 ELSIF v_m.scope_type='corporate_company' THEN
  v_scope:=v_m.corporate_company_id;
  v_roles:=ARRAY['accountant','coupon_issuer','driver','finance_manager'];
 ELSE RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF v_m.role_code<>ALL(v_roles) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROTECTED_ROLE';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships a
   WHERE a.user_id=p_actor_id AND a.active
   AND a.scope_type=v_m.scope_type AND
    ((v_m.scope_type='station' AND a.station_id=v_scope AND
      a.role_code IN ('station_owner','owner'))
      OR (v_m.scope_type='corporate_company' AND a.corporate_company_id=v_scope
      AND a.role_code='corporate_admin')))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_action='edit' THEN
  IF p_role_code IS NULL OR p_role_code<>ANY(v_roles) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_ROLE';END IF;
  IF v_m.role_code='driver' AND p_role_code<>'driver'
      AND EXISTS(SELECT 1 FROM public.coupons c
       JOIN public.corporate_drivers cd ON cd.id=c.driver_id
       WHERE cd.user_id=v_m.user_id AND cd.company_id=v_scope
       AND c.status IN ('reserved','verified','fueling'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DRIVER_HAS_ACTIVE_COUPON';END IF;
  UPDATE public.memberships SET role_code=p_role_code WHERE id=v_m.id;
 ELSIF p_action='deactivate' THEN
  IF v_m.role_code='driver'
      AND EXISTS(SELECT 1 FROM public.coupons c
       JOIN public.corporate_drivers cd ON cd.id=c.driver_id
       WHERE cd.user_id=v_m.user_id AND cd.company_id=v_scope
       AND c.status IN ('reserved','verified','fueling'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='DRIVER_HAS_ACTIVE_COUPON';END IF;
  UPDATE public.memberships SET active=false WHERE id=v_m.id;
 ELSE RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_ACTION';END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,before_state,after_state)
 VALUES(p_actor_id,CASE WHEN v_m.scope_type='station' THEN v_scope ELSE NULL END,
  'membership',v_m.id::text,
  CASE WHEN p_action='deactivate' THEN 'membership_deactivated' ELSE 'membership_role_changed' END,
  jsonb_build_object('role',v_m.role_code,'active',true),
  jsonb_build_object('role',CASE WHEN p_action='edit' THEN p_role_code ELSE v_m.role_code END,
                     'active',p_action<>'deactivate'));
 RETURN jsonb_build_object('membershipId',v_m.id,'action',p_action,'success',true);
END $fn$;

CREATE OR REPLACE FUNCTION public.oilstation_hr_employee_change(
 p_actor_id uuid,p_station_id uuid,p_employee_id uuid,p_action text,p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_emp public.employees%ROWTYPE;
BEGIN
 IF p_actor_id IS NULL OR p_station_id IS NULL OR p_employee_id IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.memberships m
     WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
      AND m.station_id=p_station_id
      AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
    OR NOT EXISTS(SELECT 1 FROM public.station_modules sm
     WHERE sm.station_id=p_station_id AND sm.module_code='hr_payroll' AND sm.status='enabled')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO v_emp FROM public.employees e
 WHERE e.id=p_employee_id AND e.station_id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_action='edit' THEN
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 200
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  UPDATE public.employees SET display_name=btrim(p_name)
  WHERE id=v_emp.id;
 ELSIF p_action='deactivate' THEN
  IF v_emp.employment_status<>'active' THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_INACTIVE';END IF;
  -- Refuse leaving future shifts without an assigned active employee.
  IF EXISTS(SELECT 1 FROM public.shift_assignments a
   WHERE a.employee_id=v_emp.id AND a.shift_date>=current_date
    AND a.status IN ('scheduled','absence_review'))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FUTURE_SHIFT_EXISTS';END IF;
  UPDATE public.employees SET employment_status='inactive' WHERE id=v_emp.id;
 ELSE RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_ACTION';END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,before_state,after_state)
 VALUES(p_actor_id,p_station_id,'employee',v_emp.id::text,
   CASE WHEN p_action='edit' THEN 'employee_name_updated' ELSE 'employee_deactivated' END,
   jsonb_build_object('name',v_emp.display_name,'status',v_emp.employment_status),
   jsonb_build_object('name',CASE WHEN p_action='edit' THEN btrim(p_name) ELSE v_emp.display_name END,
     'status',CASE WHEN p_action='edit' THEN v_emp.employment_status ELSE 'inactive' END));
 RETURN jsonb_build_object('employeeId',v_emp.id,'success',true,'action',p_action);
END $fn$;

REVOKE ALL ON FUNCTION public.oilstation_station_customer_overview(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_fuel_report_by_plate(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_scoped_member_directory(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.oilstation_scoped_member_change(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_station_customer_overview(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_fuel_report_by_plate(uuid,uuid,uuid,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_scoped_member_directory(uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.oilstation_scoped_member_change(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.oilstation_hr_employee_change(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_hr_employee_change(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
