-- Delegation: a Sales can onboard staff ONLY into a station they opened
-- and still actively manage. Transfer/expiry ends this delegation at once.
-- The creator check also protects another Sales' station from becoming
-- eligible merely because an assignment record was inserted later.
CREATE OR REPLACE FUNCTION public.oilstation_sales_owns_scope(
 p_actor_id uuid,p_scope_type text,p_scope_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_found boolean;
BEGIN
 IF p_actor_id IS NULL OR p_scope_id IS NULL
 OR p_scope_type NOT IN ('station','organization') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active
      AND m.scope_type='platform' AND m.role_code='platform_sales')
 THEN RETURN false; END IF;
 IF p_scope_type='station' THEN
  SELECT EXISTS (
   SELECT 1 FROM public.sales_assignments sa
    JOIN public.sales_station_creation_requests r ON r.station_id=sa.station_id
    JOIN public.stations s ON s.id=sa.station_id
   WHERE sa.sales_user_id=p_actor_id AND r.actor_id=p_actor_id
    AND sa.station_id=p_scope_id
    AND sa.effective_from<=clock_timestamp()
    AND (sa.effective_until IS NULL OR sa.effective_until>clock_timestamp())
  ) INTO v_found;
  RETURN v_found;
 END IF;
 -- Granting an organization owner could give implicit access to every branch.
 -- Refuse delegation if even one branch of the organization is not owned by
 -- this Sales (one Sales-owned branch alone is NOT sufficient).
 SELECT EXISTS(SELECT 1 FROM public.stations s WHERE s.organization_id=p_scope_id)
   AND NOT EXISTS(
    SELECT 1 FROM public.stations s
    WHERE s.organization_id=p_scope_id
    AND NOT public.oilstation_sales_owns_scope(p_actor_id,'station',s.id)
   ) INTO v_found;
 RETURN v_found;
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_sales_owns_scope(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_sales_owns_scope(uuid,text,uuid)
 TO service_role;

-- QA Sales only: the approved four-node list is an UAT boundary, not a public
-- tenant directory. Return IDs that pass the database-owned creator test.
CREATE OR REPLACE FUNCTION public.oilstation_qa_sales_scopes(
 p_actor_id uuid,p_qa_run_id text,p_organization_ids uuid[],p_station_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_org jsonb;v_station jsonb;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR cardinality(p_organization_ids) IS DISTINCT FROM 4
 OR cardinality(p_station_ids) IS DISTINCT FROM 4
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_actor_id
   AND u.raw_app_meta_data->>'oilstation_qa'='true'
   AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 SELECT coalesce(jsonb_agg(x.id ORDER BY x.ord),'[]'::jsonb) INTO v_station
 FROM unnest(p_station_ids) WITH ORDINALITY x(id,ord)
 WHERE public.oilstation_sales_owns_scope(p_actor_id,'station',x.id);
 SELECT coalesce(jsonb_agg(x.id ORDER BY x.ord),'[]'::jsonb) INTO v_org
 FROM unnest(p_organization_ids) WITH ORDINALITY x(id,ord)
 WHERE public.oilstation_sales_owns_scope(p_actor_id,'organization',x.id);
 RETURN jsonb_build_object('station',v_station,'organization',v_org);
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_sales_scopes(uuid,text,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_sales_scopes(uuid,text,uuid[],uuid[])
 TO service_role;

-- Extend existing invitation policy without changing non-Sales approval paths.
-- Invitation creation is only available to an active authorized manager.
-- Tokens generated with the Worker crypto API; only their SHA-256 hashes are stored.
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
  v_allowed:=v_platform_admin OR v_sales_owns_station OR EXISTS(
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
  IF p_role_code='station_owner' AND NOT (v_platform_admin OR v_sales_owns_station) THEN
    v_allowed:=EXISTS(
      SELECT 1 FROM public.memberships m
      JOIN public.stations s ON s.organization_id=m.organization_id
      WHERE s.id=p_station_id AND m.user_id=p_actor_id AND m.active
      AND m.scope_type='organization' AND m.role_code IN ('organization_owner','owner')
    );
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
    AND (m.role_code='corporate_admin'
      OR m.extra_permissions->>'invite_company_staff'='true')
  );
 ELSIF p_scope_type='organization' THEN
  IF p_organization_id IS NULL OR p_station_id IS NOT NULL OR p_company_id IS NOT NULL
    OR p_role_code NOT IN ('organization_owner','organization_manager','billing_manager')
    OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_sales_owns_org:=public.oilstation_sales_owns_scope(p_actor_id,'organization',p_organization_id);
  v_allowed:=v_platform_admin OR v_sales_owns_org OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=p_organization_id
    AND m.role_code='organization_owner'
  );
  IF p_role_code='organization_owner' AND NOT (v_platform_admin OR v_sales_owns_org) THEN
    v_allowed:=false;
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

-- Extend QA atomic registration with an independent Sales ownership check.
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
 v_is_admin boolean;
 v_sales_owns boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 INTO v_is_admin;
 v_sales_owns:=public.oilstation_sales_owns_scope(p_actor_id,p_scope_type,p_scope_id);
 IF p_actor_id IS NULL OR NOT(v_is_admin OR v_sales_owns) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;
 -- A Sales cannot create another Sales, Support, Corporate or Admin account,
 -- even with forged Worker parameters. Scope is rechecked within the same
 -- SQL transaction immediately before membership/audit insertion.
 IF NOT v_is_admin AND p_scope_type NOT IN ('organization','station') THEN
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
