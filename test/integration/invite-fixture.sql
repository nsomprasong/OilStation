-- Minimal invitation-only PostgreSQL fixture. All identities are synthetic.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(
 id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE TABLE public.invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL,
 token_hash text UNIQUE NOT NULL,role_code text NOT NULL,
 scope_type text NOT NULL,organization_id uuid,station_id uuid,
 corporate_company_id uuid,permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
 invited_by uuid,expires_at timestamptz NOT NULL,
 accepted_at timestamptz,revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.app_users(id uuid PRIMARY KEY,email text);
CREATE TABLE public.memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.app_users(id),
 role_code text NOT NULL,scope_type text NOT NULL,
 organization_id uuid,station_id uuid,corporate_company_id uuid,
 extra_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
 active boolean NOT NULL DEFAULT true);
CREATE TABLE public.audit_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid,station_id uuid,organization_id uuid,
 entity_type text NOT NULL,entity_id text,action text NOT NULL,
 after_state jsonb,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('11111111-1111-4111-8111-111111111111','facebook@example.com',now()),
('22222222-2222-4222-8222-222222222222','other@example.com',now()),
('33333333-3333-4333-8333-333333333333','matched@example.com',now()),
('44444444-4444-4444-8444-444444444444',NULL,NULL);
INSERT INTO public.invitations(id,email,token_hash,role_code,scope_type,station_id,expires_at)
 VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','invited@example.com',repeat('a',64),
 'attendant','station','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
 clock_timestamp()+interval '2 hours'
 ),(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','matched@example.com',repeat('b',64),
 'cashier','station','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
 clock_timestamp()+interval '2 hours'
 ),(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','noemail-invite@example.com',repeat('c',64),
 'attendant','station','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
 clock_timestamp()+interval '2 hours'
 );
