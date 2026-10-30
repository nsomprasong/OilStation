-- Invite redemption is server-only. A social login can claim an invitation
-- only when Supabase Auth confirms ownership of the invited email.
-- If Facebook provides a different/no email, a separate invited-email OTP
-- verification flow is REQUIRED before this function will permit linking.
CREATE OR REPLACE FUNCTION public.accept_member_invitation(
  p_actor_id uuid,p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_auth_email text;
  v_confirmed_at timestamptz;
  v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_INVITATION';
  END IF;
  SELECT u.email,u.email_confirmed_at INTO v_auth_email,v_confirmed_at
    FROM auth.users u WHERE u.id=p_actor_id;
  IF v_auth_email IS NULL OR v_confirmed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
  END IF;
  SELECT * INTO v_inv FROM public.invitations
    WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL
    OR v_inv.expires_at<=v_now THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITE_INVALID_OR_EXPIRED';
  END IF;
  IF lower(btrim(v_auth_email))<>lower(btrim(v_inv.email)) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITED_EMAIL_MISMATCH';
  END IF;
  IF NOT (
   (v_inv.scope_type='platform' AND v_inv.organization_id IS NULL
      AND v_inv.station_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='organization' AND v_inv.organization_id IS NOT NULL
      AND v_inv.station_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='station' AND v_inv.station_id IS NOT NULL
      AND v_inv.organization_id IS NULL AND v_inv.corporate_company_id IS NULL)
   OR (v_inv.scope_type='corporate_company' AND v_inv.corporate_company_id IS NOT NULL
      AND v_inv.station_id IS NULL AND v_inv.organization_id IS NULL)
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_INVITATION'; END IF;
  INSERT INTO public.app_users(id,email) VALUES(p_actor_id,v_auth_email)
   ON CONFLICT (id) DO UPDATE SET email=excluded.email;
  INSERT INTO public.memberships(user_id,role_code,scope_type,
    organization_id,station_id,corporate_company_id,extra_permissions)
  VALUES(p_actor_id,v_inv.role_code,v_inv.scope_type,v_inv.organization_id,
    v_inv.station_id,v_inv.corporate_company_id,v_inv.permissions)
  ON CONFLICT DO NOTHING;
  UPDATE public.invitations SET accepted_at=v_now WHERE id=v_inv.id;
  INSERT INTO public.audit_events(actor_id,station_id,organization_id,entity_type,
    entity_id,action,after_state)
  VALUES(p_actor_id,v_inv.station_id,v_inv.organization_id,'invitation',
    v_inv.id::text,'accepted',jsonb_build_object('scope_type',v_inv.scope_type,
      'role_code',v_inv.role_code));
  RETURN jsonb_build_object('accepted',true,'scope_type',v_inv.scope_type,
    'role_code',v_inv.role_code);
END
$fn$;
REVOKE ALL ON FUNCTION public.accept_member_invitation(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_member_invitation(uuid,text) TO service_role;
