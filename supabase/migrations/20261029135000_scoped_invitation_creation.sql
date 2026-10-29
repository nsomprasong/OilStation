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
    OR p_role_code NOT IN ('station_owner','manager','cashier','pump_staff','attendant') OR
    NOT EXISTS(SELECT 1 FROM public.stations s WHERE s.id=p_station_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
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
    OR p_role_code NOT IN ('organization_owner','organization_manager')
    OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=p_organization_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
  END IF;
  v_allowed:=v_platform_admin OR EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='organization' AND m.organization_id=p_organization_id
    AND m.role_code='organization_owner'
  );
  IF p_role_code='organization_owner' AND NOT v_platform_admin THEN
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
