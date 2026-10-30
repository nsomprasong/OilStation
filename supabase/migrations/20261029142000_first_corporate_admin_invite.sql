-- Bootstrap invite for the first administrator of a newly created corporate
-- company. Once ANY active corporate_admin exists, only its own company admin
-- can invite further company staff via create_scoped_invitation.
CREATE OR REPLACE FUNCTION public.station_invite_first_corporate_admin(
 p_actor_id uuid,p_station_id uuid,p_company_id uuid,
 p_email text,p_token_hash text,p_expires_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_organization_id uuid;v_id uuid:=gen_random_uuid();
BEGIN
 SELECT organization_id INTO v_organization_id FROM public.stations WHERE id=p_station_id;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.corporate_station_accounts a
   WHERE a.station_id=p_station_id AND a.company_id=p_company_id) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.active AND (
     (m.scope_type='platform' AND m.role_code='platform_superadmin')
     OR (m.scope_type='organization' AND m.organization_id=v_organization_id
       AND m.role_code IN ('organization_owner','owner'))
     OR (m.scope_type='station' AND m.station_id=p_station_id
       AND m.role_code IN ('station_owner','owner'))
   )) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_email IS NULL OR p_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
   OR length(p_email)>320
   OR p_token_hash !~ '^[a-f0-9]{64}$'
   OR p_expires_at<=clock_timestamp()
   OR p_expires_at>clock_timestamp()+interval '30 days' THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Protect the first-admin slot against parallel invitations from two stations
 -- of the same corporate company, without using client-supplied locking keys.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
 IF EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.corporate_company_id=p_company_id AND m.active
     AND m.scope_type='corporate_company' AND m.role_code='corporate_admin'
 ) OR EXISTS(SELECT 1 FROM public.invitations i
   WHERE i.corporate_company_id=p_company_id
   AND i.role_code='corporate_admin' AND i.scope_type='corporate_company'
   AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>clock_timestamp()
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ADMIN_ALREADY_INVITED';END IF;
 INSERT INTO public.invitations(id,email,token_hash,role_code,scope_type,
  corporate_company_id,invited_by,expires_at)
 VALUES(v_id,lower(btrim(p_email)),p_token_hash,'corporate_admin','corporate_company',
  p_company_id,p_actor_id,p_expires_at);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'invitation',v_id::text,'first_corporate_admin_invited',
  jsonb_build_object('company_id',p_company_id));
 RETURN jsonb_build_object('id',v_id,'email',lower(btrim(p_email)),
   'role','corporate_admin','scopeType','corporate_company','expiresAt',p_expires_at);
END $f$;
REVOKE ALL ON FUNCTION public.station_invite_first_corporate_admin(uuid,uuid,uuid,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_invite_first_corporate_admin(uuid,uuid,uuid,text,text,timestamptz)
 TO service_role;
