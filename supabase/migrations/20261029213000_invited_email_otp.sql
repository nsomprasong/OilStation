-- Authenticated, email-independent invite ownership proof.
-- This feature is inert until the Worker has a verified outbound email sender.
-- Secrets/OTP plaintext never enter this table: proof_hash is a domain-separated
-- server-only HMAC over actor ID + invitation hash + eight-digit code.
CREATE TABLE IF NOT EXISTS public.invited_email_otp(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invitation_id uuid NOT NULL REFERENCES public.invitations(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 proof_hash text NOT NULL CHECK(proof_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 verified_at timestamptz,
 consumed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.invited_email_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_email_otp FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.invited_email_otp FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS invited_email_otp_actor_created_idx
 ON public.invited_email_otp(invitation_id,actor_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.begin_invited_email_otp(
 p_actor_id uuid,p_token_hash text,p_proof_hash text,p_expires_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_inv public.invitations%ROWTYPE;
 v_now timestamptz:=clock_timestamp();v_id uuid:=gen_random_uuid();v_count integer;
 v_auth_email text;v_confirmed timestamptz;
BEGIN
 IF p_actor_id IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
  OR p_proof_hash !~ '^[a-f0-9]{64}$'
  OR p_expires_at IS NULL OR p_expires_at<v_now+interval '5 minutes'
  OR p_expires_at>v_now+interval '11 minutes'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_inv FROM public.invitations WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR v_inv.accepted_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL
   OR v_inv.expires_at<=v_now THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITE_INVALID_OR_EXPIRED';END IF;
 SELECT email,email_confirmed_at INTO v_auth_email,v_confirmed
 FROM auth.users WHERE id=p_actor_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF v_auth_email IS NOT NULL AND v_confirmed IS NOT NULL
    AND lower(btrim(v_auth_email))=lower(btrim(v_inv.email))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT count(*) INTO v_count FROM public.invited_email_otp
 WHERE invitation_id=v_inv.id AND actor_id=p_actor_id
 AND created_at>v_now-interval '1 hour';
 IF v_count>=3 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='RATE_LIMITED';END IF;
 -- A newer challenge supersedes older codes for this actor and invite.
 UPDATE public.invited_email_otp SET consumed_at=v_now
 WHERE invitation_id=v_inv.id AND actor_id=p_actor_id AND consumed_at IS NULL;
 INSERT INTO public.invited_email_otp(id,invitation_id,actor_id,proof_hash,expires_at)
 VALUES(v_id,v_inv.id,p_actor_id,p_proof_hash,p_expires_at);
 -- Full address is sent ONLY to trusted Worker to dispatch the OTP.
 RETURN jsonb_build_object('id',v_id,'email',v_inv.email,'expiresAt',p_expires_at);
END $fn$;
REVOKE ALL ON FUNCTION public.begin_invited_email_otp(uuid,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_invited_email_otp(uuid,text,text,timestamptz)
 TO service_role;

-- Forward replacement of an already applied function. Preserve old confirmed
-- same-email fast path; OTP proof is required only for different/missing emails.
CREATE OR REPLACE FUNCTION public.accept_member_invitation(
  p_actor_id uuid,p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_auth_email text;
  v_proven boolean:=false;
  v_confirmed_at timestamptz;
  v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_INVITATION';
  END IF;
  SELECT u.email,u.email_confirmed_at INTO v_auth_email,v_confirmed_at
    FROM auth.users u WHERE u.id=p_actor_id;
  SELECT * INTO v_inv FROM public.invitations
    WHERE token_hash=p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL
    OR v_inv.expires_at<=v_now THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITE_INVALID_OR_EXPIRED';
  END IF;
  -- Facebook identities may use a DIFFERENT email, but only after a
  -- separately delivered, short-lived, actor+invitation-bound OTP is verified.
  SELECT EXISTS(
    SELECT 1 FROM public.invited_email_otp v
    WHERE v.invitation_id=v_inv.id AND v.actor_id=p_actor_id
      AND v.verified_at IS NOT NULL AND v.consumed_at IS NULL
      AND v.expires_at>v_now AND v.attempts<5
  ) INTO v_proven;
  IF NOT v_proven AND (v_auth_email IS NULL OR v_confirmed_at IS NULL)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='EMAIL_VERIFICATION_REQUIRED';END IF;
  IF NOT v_proven AND lower(btrim(v_auth_email))<>lower(btrim(v_inv.email))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITED_EMAIL_MISMATCH';END IF;
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
  INSERT INTO public.app_users(id,email) VALUES(p_actor_id,CASE WHEN v_proven AND v_confirmed_at IS NULL
    THEN v_inv.email ELSE v_auth_email END)
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
GRANT EXECUTE ON FUNCTION public.accept_member_invitation(uuid,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_invited_email_otp(
 p_actor_id uuid,p_token_hash text,p_proof_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_inv public.invitations%ROWTYPE;
 v public.invited_email_otp%ROWTYPE;v_now timestamptz:=clock_timestamp();
 v_result jsonb;
BEGIN
 IF p_actor_id IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
  OR p_proof_hash !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_inv FROM public.invitations WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR v_inv.accepted_at IS NOT NULL OR v_inv.revoked_at IS NOT NULL
  OR v_inv.expires_at<=v_now THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVITE_INVALID_OR_EXPIRED';END IF;
 SELECT * INTO v FROM public.invited_email_otp
 WHERE invitation_id=v_inv.id AND actor_id=p_actor_id
 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND OR v.expires_at<=v_now OR v.consumed_at IS NOT NULL OR v.attempts>=5
 THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_or_expired');END IF;
 IF v.proof_hash<>p_proof_hash THEN
  UPDATE public.invited_email_otp SET attempts=attempts+1 WHERE id=v.id;
  -- Return rather than RAISE so incorrect attempts persist across requests.
  RETURN jsonb_build_object('accepted',false,'reason','invalid_or_expired');
 END IF;
 UPDATE public.invited_email_otp SET verified_at=v_now WHERE id=v.id;
 v_result:=public.accept_member_invitation(p_actor_id,p_token_hash);
 UPDATE public.invited_email_otp SET consumed_at=v_now WHERE id=v.id;
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.confirm_invited_email_otp(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_invited_email_otp(uuid,text,text)
 TO service_role;
