-- Case OS-QA-ST-MEMBER-ROLE-WRITE-009 uncovered a production validation error.
-- The original p_role_code<>ANY(v_roles) rejects every valid code because at
-- least one other allowed role differs. <>ALL is the intended allowlist guard.
-- Preserve authorization, protected roles, coupon holds, audit trail, grants.
BEGIN;
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
  IF p_role_code IS NULL OR p_role_code<>ALL(v_roles) THEN
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

REVOKE ALL ON FUNCTION public.oilstation_scoped_member_change(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_scoped_member_change(uuid,uuid,text,text) TO service_role;
COMMIT;
