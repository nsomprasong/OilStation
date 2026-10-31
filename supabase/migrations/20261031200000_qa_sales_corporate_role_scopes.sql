-- QA Corporate role delegation after 12 verified zero-balance companies.
-- Real Corporate invitation policy unchanged; QA synthetic accounts only.
CREATE OR REPLACE FUNCTION public.oilstation_sales_owns_scope(
 p_actor_id uuid,p_scope_type text,p_scope_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_found boolean;
BEGIN
 IF p_actor_id IS NULL OR p_scope_id IS NULL
 OR p_scope_type NOT IN ('station','organization','corporate_company') THEN RETURN false; END IF;
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
 IF p_scope_type='corporate_company' THEN
  -- Corporate may be shared across several stations. A Sales gets QA
  -- company-role rights only if every linked station is currently
  -- creator-owned by the SAME Sales; never one shared station alone.
  SELECT EXISTS(
    SELECT 1 FROM public.corporate_station_accounts a WHERE a.company_id=p_scope_id
  ) AND NOT EXISTS(
    SELECT 1 FROM public.corporate_station_accounts a
    WHERE a.company_id=p_scope_id
     AND NOT public.oilstation_sales_owns_scope(p_actor_id,'station',a.station_id)
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


-- Return only the QA company's UUIDs belonging wholly to the caller's
-- currently creator-owned Sales stations. The server-listed 12 fixed IDs are
-- checked against exact company names, station names, and associations.
CREATE OR REPLACE FUNCTION public.oilstation_qa_sales_corporate_scopes(
 p_actor_id uuid,p_qa_run_id text,p_station_ids uuid[],p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_idx integer;
 v_station_idx integer;
 v_slot integer;
 v_expected text;
 v_return jsonb;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR cardinality(p_station_ids) IS DISTINCT FROM 4
 OR cardinality(p_company_ids) IS DISTINCT FROM 12
 OR p_actor_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM auth.users u
  WHERE u.id=p_actor_id AND u.raw_app_meta_data->>'oilstation_qa'='true'
   AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 FOR v_idx IN 1..4 LOOP
  IF NOT EXISTS(SELECT 1 FROM public.stations s
    WHERE s.id=p_station_ids[v_idx] AND s.name=v_names[v_idx])
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 END LOOP;
 FOR v_idx IN 1..12 LOOP
  v_station_idx:=((v_idx-1)/3)+1;
  v_slot:=((v_idx-1)%3)+1;
  v_expected:=v_names[v_station_idx]||'-C0'||v_slot::text;
  IF NOT EXISTS(SELECT 1 FROM public.corporate_companies c
    JOIN public.corporate_station_accounts a ON a.company_id=c.id
    WHERE c.id=p_company_ids[v_idx] AND c.name=v_expected
      AND a.station_id=p_station_ids[v_station_idx])
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 END LOOP;
 SELECT coalesce(pg_catalog.jsonb_agg(x.id ORDER BY x.ord),'[]'::jsonb)
 INTO v_return
 FROM unnest(p_company_ids) WITH ORDINALITY x(id,ord)
 WHERE public.oilstation_sales_owns_scope(p_actor_id,'corporate_company',x.id);
 RETURN v_return;
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_sales_corporate_scopes(uuid,text,uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_sales_corporate_scopes(uuid,text,uuid[],uuid[])
 TO service_role;

-- Extend existing Worker-only atomic QA membership registration to Sales
-- whose entire company-to-station set is currently creator-owned.
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
 -- A QA Sales cannot create another Sales, Support or Platform Admin account,
 -- even with forged Worker parameters. Scope is rechecked within the same
 -- SQL transaction immediately before membership/audit insertion.
 IF NOT v_is_admin AND p_scope_type NOT IN ('organization','station','corporate_company') THEN
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
