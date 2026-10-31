-- QA account registration repair: REST writes to app_users, memberships and
-- audit_events are deliberately not GRANTed to service_role. Keep that rule.
-- Only the trusted Worker (after verified Platform Super Admin auth) can call
-- this narrow RPC. Auth user is created beforehand through Supabase Auth Admin.
CREATE OR REPLACE FUNCTION public.platform_qa_register_account(
 p_actor_id uuid,p_user_id uuid,p_alias text,p_role_code text,
 p_scope_type text,p_scope_id uuid,p_qa_run_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_email text;
 v_meta jsonb;
 v_membership_id uuid;
 v_exists boolean;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='platform' AND m.role_code='platform_superadmin'
 ) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;
 IF p_user_id IS NULL OR p_actor_id=p_user_id
  OR p_alias IS NULL OR p_alias !~ '^[a-z][a-z0-9-]{2,30}$'
  OR p_qa_run_id IS NULL OR p_qa_run_id !~ '^QA-[0-9]{8}-[A-Z0-9-]{3,40}$'
  OR p_role_code IS NULL OR p_scope_type IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_REQUEST'; END IF;

 SELECT u.email,u.raw_app_meta_data INTO v_email,v_meta
 FROM auth.users u WHERE u.id=p_user_id;
 IF NOT FOUND OR v_email IS DISTINCT FROM
      ('qa-'||p_alias||'@qa.oilstation.invalid')
  OR coalesce(v_meta->>'oilstation_qa','false')<>'true'
  OR v_meta->>'oilstation_qa_run_id' IS DISTINCT FROM p_qa_run_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_IDENTITY'; END IF;

 IF p_scope_type='platform' THEN
  IF p_scope_id IS NOT NULL OR NOT (
    (p_role_code='platform_sales' AND p_alias IN('sales01','sales02')) OR
    (p_role_code='platform_support' AND p_alias='support01')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_ROLE'; END IF;
 ELSIF p_scope_type='organization' THEN
  IF p_scope_id IS NULL OR p_role_code NOT IN('organization_owner','billing_manager')
  OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_scope_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE'; END IF;
 ELSIF p_scope_type='station' THEN
  IF p_scope_id IS NULL OR p_role_code NOT IN
   ('station_owner','manager','cashier','attendant','pump_staff','hr_manager','finance_manager')
  OR NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_scope_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE'; END IF;
 ELSIF p_scope_type='corporate_company' THEN
  IF p_scope_id IS NULL OR p_role_code NOT IN
   ('corporate_admin','coupon_issuer','accountant','finance_manager','driver')
  OR NOT EXISTS(SELECT 1 FROM public.corporate_companies c WHERE c.id=p_scope_id)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE'; END IF;
 ELSE RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE';
 END IF;

 -- Never silently alter an existing user. The application only provisions new Auth IDs.
 IF EXISTS(SELECT 1 FROM public.app_users a WHERE a.id=p_user_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_ID_ALREADY_REGISTERED'; END IF;

 -- All of the following commits atomically, including role and audit.
 INSERT INTO public.app_users(id,email,display_name,status)
 VALUES(p_user_id,v_email,'QA '||p_alias,'active');
 INSERT INTO public.memberships(user_id,role_code,scope_type,
  organization_id,station_id,corporate_company_id,active)
 VALUES(p_user_id,p_role_code,p_scope_type,
  CASE WHEN p_scope_type='organization' THEN p_scope_id END,
  CASE WHEN p_scope_type='station' THEN p_scope_id END,
  CASE WHEN p_scope_type='corporate_company' THEN p_scope_id END,
  true) RETURNING id INTO v_membership_id;
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'qa_account',p_user_id::text,'qa_account_provisioned',
  pg_catalog.jsonb_build_object('qaRunId',p_qa_run_id,'alias',p_alias,
   'roleCode',p_role_code,'scopeType',p_scope_type,'scopeId',p_scope_id,
   'membershipId',v_membership_id));
 RETURN pg_catalog.jsonb_build_object('id',p_user_id,'membershipId',v_membership_id,
  'alias',p_alias,'roleCode',p_role_code,'scopeType',p_scope_type,
  'scopeId',p_scope_id);
END $$;
REVOKE ALL ON FUNCTION public.platform_qa_register_account(
 uuid,uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_qa_register_account(
 uuid,uuid,text,text,text,uuid,text) TO service_role;
