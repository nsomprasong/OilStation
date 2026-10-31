-- Roles for QA personnel creation: never Sales.
-- Regular first-admin onboarding and invitations remain separate.
-- QA station owner bootstraps exactly one corporate_admin at a linked QA company.
-- Then that company's own corporate_admin provisions its four QA employees.
-- Service role RPCs only; browser users never receive database table grants.
CREATE OR REPLACE FUNCTION public.oilstation_qa_admin_company_scopes(
 p_actor_id uuid,p_qa_run_id text,p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_idx integer;v_station_idx integer;v_slot integer;v_return jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR cardinality(p_station_ids) IS DISTINCT FROM 4
 OR cardinality(p_company_ids) IS DISTINCT FROM 12
 OR (SELECT count(DISTINCT id) FROM unnest(p_station_ids) AS x(id))<>4
 OR (SELECT count(DISTINCT id) FROM unnest(p_company_ids) AS x(id))<>12
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_actor_id
  AND u.raw_app_meta_data->>'oilstation_qa'='true'
  AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 FOR v_idx IN 1..4 LOOP
  IF NOT EXISTS(SELECT 1 FROM public.stations s
    WHERE s.id=p_station_ids[v_idx] AND s.name=v_names[v_idx])
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 END LOOP;
 FOR v_idx IN 1..12 LOOP
  v_station_idx:=((v_idx-1)/3)+1;v_slot:=((v_idx-1)%3)+1;
  IF NOT EXISTS(SELECT 1 FROM public.corporate_companies c
    JOIN public.corporate_station_accounts a ON a.company_id=c.id
    WHERE c.id=p_company_ids[v_idx] AND c.name=v_names[v_station_idx]||'-C0'||v_slot::text
      AND a.station_id=p_station_ids[v_station_idx])
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(q.id ORDER BY q.ord),'[]'::jsonb) INTO v_return
 FROM unnest(p_company_ids) WITH ORDINALITY AS q(id,ord)
 WHERE EXISTS(
   SELECT 1 FROM public.memberships m
   JOIN public.corporate_station_accounts a ON a.station_id=m.station_id
   WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='station'
     AND m.role_code='station_owner' AND a.company_id=q.id
 ) AND NOT EXISTS (
   SELECT 1 FROM public.corporate_station_accounts a
   WHERE a.company_id=q.id AND NOT EXISTS(
     SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
       AND m.scope_type='station' AND m.role_code='station_owner'
       AND m.station_id=a.station_id
   )
 ) AND NOT EXISTS (
   SELECT 1 FROM public.memberships m WHERE m.active
     AND m.scope_type='corporate_company' AND m.role_code='corporate_admin'
     AND m.corporate_company_id=q.id
 );
 RETURN v_return;
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_admin_company_scopes(uuid,text,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_admin_company_scopes(uuid,text,uuid[],uuid[])
 TO service_role;

CREATE OR REPLACE FUNCTION public.platform_qa_register_account(
 p_actor_id uuid,p_user_id uuid,p_alias text,p_role_code text,
 p_scope_type text,p_scope_id uuid,p_qa_run_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_email text;v_meta jsonb;v_mid uuid;v_platform_admin boolean;
 v_actor_qa boolean;v_can_create boolean:=false;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 INTO v_platform_admin;
 SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_actor_id
  AND u.raw_app_meta_data->>'oilstation_qa'='true'
  AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id)
 INTO v_actor_qa;
 IF p_actor_id IS NULL OR p_user_id IS NULL OR p_actor_id=p_user_id
 OR p_alias IS NULL OR p_alias !~ '^[a-z][a-z0-9-]{2,30}$'
 OR p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR p_role_code IS NULL OR p_scope_type IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_REQUEST';END IF;
 SELECT u.email,u.raw_app_meta_data INTO v_email,v_meta
 FROM auth.users u WHERE u.id=p_user_id;
 IF NOT FOUND OR v_email IS DISTINCT FROM ('qa-'||p_alias||'@qa.oilstation.invalid')
  OR coalesce(v_meta->>'oilstation_qa','false')<>'true'
  OR v_meta->>'oilstation_qa_run_id' IS DISTINCT FROM p_qa_run_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_IDENTITY';END IF;

 IF p_scope_type='platform' THEN
  v_can_create:=v_platform_admin AND p_scope_id IS NULL
    AND ((p_role_code='platform_sales' AND p_alias IN('sales01','sales02'))
      OR (p_role_code='platform_support' AND p_alias='support01'));
 ELSIF p_scope_type='organization' THEN
  IF p_scope_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations o JOIN public.stations s
    ON s.organization_id=o.id WHERE o.id=p_scope_id AND s.name LIKE 'QA-S%')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE';END IF;
  v_can_create:=(v_platform_admin AND p_role_code IN ('organization_owner','billing_manager'))
   OR (v_actor_qa AND p_role_code='billing_manager' AND EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
     AND m.scope_type='organization' AND m.role_code='organization_owner'
     AND m.organization_id=p_scope_id));
 ELSIF p_scope_type='station' THEN
  IF p_scope_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.stations s WHERE s.id=p_scope_id AND s.name LIKE 'QA-S%')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE';END IF;
  v_can_create:=(v_platform_admin AND p_role_code IN
    ('station_owner','manager','cashier','attendant','pump_staff','hr_manager','finance_manager'))
    OR (v_actor_qa AND p_role_code IN
    ('manager','cashier','attendant','pump_staff','hr_manager','finance_manager')
    AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
     AND m.active AND m.scope_type='station' AND m.role_code='station_owner'
     AND m.station_id=p_scope_id));
 ELSIF p_scope_type='corporate_company' THEN
  IF p_scope_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.corporate_companies c
    WHERE c.id=p_scope_id AND c.name LIKE 'QA-S%')
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE';END IF;
  v_can_create:=(v_platform_admin AND p_role_code IN
    ('corporate_admin','coupon_issuer','accountant','finance_manager','driver'))
   OR (v_actor_qa AND p_role_code='corporate_admin'
    -- Initial company admin is bootstrapped by its linked STATION OWNER only.
    AND EXISTS(SELECT 1 FROM public.memberships m
      JOIN public.corporate_station_accounts a ON a.station_id=m.station_id
      WHERE a.company_id=p_scope_id AND m.user_id=p_actor_id
       AND m.active AND m.scope_type='station' AND m.role_code='station_owner')
    AND NOT EXISTS(SELECT 1 FROM public.corporate_station_accounts a
     WHERE a.company_id=p_scope_id AND NOT EXISTS(
       SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
        AND m.scope_type='station' AND m.role_code='station_owner'
        AND m.station_id=a.station_id))
    AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
      AND m.scope_type='corporate_company' AND m.role_code='corporate_admin'
      AND m.corporate_company_id=p_scope_id))
   OR (v_actor_qa AND p_role_code IN ('coupon_issuer','accountant','finance_manager','driver')
    AND EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
      AND m.active AND m.scope_type='corporate_company' AND m.role_code='corporate_admin'
      AND m.corporate_company_id=p_scope_id));
 ELSE
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_QA_SCOPE';
 END IF;
 IF NOT v_can_create THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF EXISTS(SELECT 1 FROM public.app_users a WHERE a.id=p_user_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_ID_ALREADY_REGISTERED';END IF;
 INSERT INTO public.app_users(id,email,display_name,status)
 VALUES(p_user_id,v_email,'QA '||p_alias,'active');
 INSERT INTO public.memberships(user_id,role_code,scope_type,
  organization_id,station_id,corporate_company_id,active)
 VALUES(p_user_id,p_role_code,p_scope_type,
  CASE WHEN p_scope_type='organization' THEN p_scope_id END,
  CASE WHEN p_scope_type='station' THEN p_scope_id END,
  CASE WHEN p_scope_type='corporate_company' THEN p_scope_id END,true)
 RETURNING id INTO v_mid;
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'qa_account',p_user_id::text,'qa_account_provisioned',
  jsonb_build_object('qaRunId',p_qa_run_id,'alias',p_alias,
  'roleCode',p_role_code,'scopeType',p_scope_type,'scopeId',p_scope_id,
  'membershipId',v_mid,'adminCreated',NOT v_platform_admin));
 RETURN jsonb_build_object('id',p_user_id,'membershipId',v_mid,
  'alias',p_alias,'roleCode',p_role_code,'scopeType',p_scope_type,'scopeId',p_scope_id);
END $fn$;
REVOKE ALL ON FUNCTION public.platform_qa_register_account(
 uuid,uuid,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_qa_register_account(
 uuid,uuid,text,text,text,uuid,text) TO service_role;

-- Revoke legacy Sales staff-invitation delegation on real invitation RPC too.
CREATE OR REPLACE FUNCTION public.create_scoped_invitation(
 p_actor_id uuid,p_email text,p_role_code text,p_scope_type text,
 p_organization_id uuid,p_station_id uuid,p_company_id uuid,
 p_token_hash text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_now timestamptz:=clock_timestamp();
 v_platform_admin boolean;
 v_sales_owns_station boolean:=false;
 v_sales_owns_org boolean:=false;
 v_allowed boolean:=false;
 v_inv_id uuid:=gen_random_uuid();
BEGIN
 IF p_actor_id IS NULL OR p_email IS NULL OR
  p_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  OR length(p_email)>320
  OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
  OR p_expires_at IS NULL OR p_expires_at<=v_now
  OR p_expires_at>v_now+interval '30 days' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.scope_type='platform' AND m.role_code='platform_superadmin'
   AND m.active) INTO v_platform_admin;

 IF p_scope_type='station' THEN
  IF p_station_id IS NULL OR p_organization_id IS NOT NULL OR p_company_id IS NOT NULL
    OR p_role_code NOT IN ('station_owner','manager','cashier','pump_staff','attendant','hr_manager','finance_manager') OR
    NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_sales_owns_station:=public.oilstation_sales_owns_scope(p_actor_id,'station',p_station_id);
  -- Sales may hand over exactly the FIRST station owner account, but cannot
  -- invite staff. After first owner exists, the station admin owns invitations.
  v_allowed:=v_platform_admin OR (v_sales_owns_station
    AND p_role_code='station_owner'
    AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
      AND m.station_id=p_station_id AND m.scope_type='station'
      AND m.role_code IN ('station_owner','owner'))) OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=p_station_id
    AND (m.role_code IN ('station_owner','owner')
      OR (m.role_code='manager' AND m.extra_permissions->>'invite_staff'='true'))
  ) OR EXISTS(
    SELECT 1 FROM public.memberships m JOIN public.stations s
    ON s.id=p_station_id WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=s.organization_id
    AND m.role_code IN ('organization_owner','owner')
  );
  IF p_role_code='station_owner' AND NOT v_platform_admin THEN
    v_allowed:=(v_sales_owns_station AND NOT EXISTS(
      SELECT 1 FROM public.memberships m WHERE m.active
        AND m.station_id=p_station_id AND m.scope_type='station'
        AND m.role_code IN ('station_owner','owner')))
      OR EXISTS(SELECT 1 FROM public.memberships m
        JOIN public.stations s ON s.organization_id=m.organization_id
        WHERE s.id=p_station_id AND m.user_id=p_actor_id AND m.active
          AND m.scope_type='organization' AND m.role_code IN ('organization_owner','owner'));
  END IF;
 ELSIF p_scope_type='corporate_company' THEN
  IF p_company_id IS NULL OR p_station_id IS NOT NULL OR p_organization_id IS NOT NULL
  OR p_role_code NOT IN ('corporate_admin','coupon_issuer','accountant','finance_manager','driver')
  OR NOT EXISTS(SELECT 1 FROM public.corporate_companies c WHERE c.id=p_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='corporate_company' AND m.corporate_company_id=p_company_id
    AND m.role_code='corporate_admin'
  );
 ELSIF p_scope_type='organization' THEN
  IF p_organization_id IS NULL OR p_station_id IS NOT NULL OR p_company_id IS NOT NULL
    OR p_role_code NOT IN ('organization_owner','organization_manager','billing_manager')
    OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_sales_owns_org:=public.oilstation_sales_owns_scope(p_actor_id,'organization',p_organization_id);
  -- Only bootstrap the initial organization owner, never its staff.
  v_allowed:=v_platform_admin OR (v_sales_owns_org
   AND p_role_code='organization_owner'
   AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active
     AND m.scope_type='organization' AND m.organization_id=p_organization_id
     AND m.role_code IN ('organization_owner','owner'))) OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=p_organization_id
    AND m.role_code='organization_owner'
  );
  IF p_role_code='organization_owner' AND NOT v_platform_admin THEN
    v_allowed:=v_sales_owns_org AND NOT EXISTS(
      SELECT 1 FROM public.memberships m WHERE m.active
       AND m.scope_type='organization' AND m.organization_id=p_organization_id
       AND m.role_code IN ('organization_owner','owner'));
  END IF;
 ELSIF p_scope_type='platform' THEN
  IF p_role_code NOT IN ('platform_sales','platform_support')
    OR p_company_id IS NOT NULL OR p_station_id IS NOT NULL
    OR p_organization_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin;
 ELSE
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF NOT v_allowed THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;

 INSERT INTO public.invitations(id,email,token_hash,role_code,scope_type,
    organization_id,station_id,corporate_company_id,invited_by,expires_at)
 VALUES(v_inv_id,lower(btrim(p_email)),p_token_hash,p_role_code,p_scope_type,
    p_organization_id,p_station_id,p_company_id,p_actor_id,p_expires_at);
 INSERT INTO public.audit_events(actor_id,station_id,organization_id,entity_type,
   entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,p_organization_id,'invitation',v_inv_id::text,
  'invite_created',jsonb_build_object('scope_type',p_scope_type,
    'role_code',p_role_code));
 RETURN jsonb_build_object('id',v_inv_id,'email',lower(btrim(p_email)),
   'role',p_role_code,'scopeType',p_scope_type,'expiresAt',p_expires_at);
END $fn$;
REVOKE ALL ON FUNCTION public.create_scoped_invitation(
 uuid,text,text,text,uuid,uuid,uuid,text,timestamptz
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_scoped_invitation(
 uuid,text,text,text,uuid,uuid,uuid,text,timestamptz
) TO service_role;

