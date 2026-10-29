-- Bootstrap may only create the FIRST platform administrator.
-- This function must be called only by a Worker configured with
-- BOOTSTRAP_ADMIN_EMAIL; the email argument is NEVER accepted from a browser.
CREATE OR REPLACE FUNCTION public.bootstrap_first_platform_admin(
 p_actor_id uuid,p_expected_email text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 auth_email text;
 auth_confirmed timestamptz;
BEGIN
 IF p_actor_id IS NULL OR nullif(btrim(p_expected_email),'') IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BOOTSTRAP_FORBIDDEN';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'oilstation:first_platform_admin',0));
 IF EXISTS (SELECT 1 FROM public.memberships m
   WHERE m.scope_type='platform' AND m.role_code='platform_superadmin' AND m.active) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_BOOTSTRAPPED';
 END IF;
 SELECT u.email,u.email_confirmed_at INTO auth_email,auth_confirmed
 FROM auth.users u WHERE u.id=p_actor_id;
 IF auth_email IS NULL OR auth_confirmed IS NULL
   OR lower(btrim(auth_email))<>lower(btrim(p_expected_email)) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='BOOTSTRAP_FORBIDDEN';
 END IF;
 INSERT INTO public.app_users(id,email,status) VALUES(p_actor_id,auth_email,'active')
 ON CONFLICT(id) DO UPDATE SET email=excluded.email;
 INSERT INTO public.memberships(user_id,role_code,scope_type,active)
 VALUES(p_actor_id,'platform_superadmin','platform',true)
 ON CONFLICT DO NOTHING;
 INSERT INTO public.audit_events(actor_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,'platform',p_actor_id::text,'first_admin_bootstrapped',
  jsonb_build_object('role_code','platform_superadmin'));
 RETURN jsonb_build_object('success',true,'role','platform_superadmin');
END
$fn$;
REVOKE ALL ON FUNCTION public.bootstrap_first_platform_admin(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_platform_admin(uuid,text) TO service_role;
