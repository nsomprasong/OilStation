-- Minimal isolated PostgreSQL fixture for the NEW SaaS billing migrations.
-- Never connect these tests to Supabase or real customer data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.app_users(id uuid PRIMARY KEY);
CREATE TABLE public.organizations(
 id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.stations(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES public.organizations(id),
 name text NOT NULL,timezone text NOT NULL DEFAULT 'Asia/Bangkok');
CREATE TABLE public.memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.app_users(id),
 active boolean NOT NULL DEFAULT true,scope_type text NOT NULL,
 role_code text NOT NULL,organization_id uuid,station_id uuid);
CREATE TABLE public.pricing_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,
 name text NOT NULL,billing_frequency text NOT NULL CHECK(billing_frequency IN ('monthly','yearly')),
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pricing_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
 module_code text CHECK(module_code IN ('qr_coupon','hr_payroll')),
 billing_method text NOT NULL CHECK(billing_method IN ('flat','bundle','per_employee','tier')),
 price_satang bigint NOT NULL CHECK(price_satang>=0),
 configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
 effective_at timestamptz NOT NULL,expires_at timestamptz);
CREATE TABLE public.station_modules(
 station_id uuid NOT NULL REFERENCES public.stations(id),module_code text NOT NULL,
 status text NOT NULL,PRIMARY KEY(station_id,module_code));
CREATE TABLE public.billing_groups(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),name text NOT NULL,
 autopay_consent boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'active',
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.billing_group_stations(
 billing_group_id uuid NOT NULL REFERENCES public.billing_groups(id),
 station_id uuid NOT NULL UNIQUE REFERENCES public.stations(id),
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(billing_group_id,station_id));
CREATE TABLE public.station_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
 starts_at timestamptz NOT NULL,current_period_end timestamptz NOT NULL,
 status text NOT NULL,price_override_satang bigint,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.saas_invoices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 billing_group_id uuid NOT NULL REFERENCES public.billing_groups(id),
 invoice_number text NOT NULL UNIQUE,
 subtotal_satang bigint NOT NULL CHECK(subtotal_satang>=0),
 discount_satang bigint NOT NULL CHECK(discount_satang>=0),
 tax_satang bigint NOT NULL CHECK(tax_satang>=0),
 total_satang bigint NOT NULL CHECK(total_satang>=0),
 status text NOT NULL CHECK(status IN ('draft','issued','pending','paid','overdue','void','refunded')),
 issued_at timestamptz,due_at timestamptz,paid_at timestamptz,
 pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.saas_invoice_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.saas_invoices(id),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 module_code text,description text NOT NULL,
 quantity numeric NOT NULL,amount_satang bigint NOT NULL,
 discount_satang bigint NOT NULL,price_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.saas_payment_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.saas_invoices(id),
 payment_method text NOT NULL CHECK(payment_method IN ('card','promptpay')),
 amount_satang bigint NOT NULL CHECK(amount_satang>0),
 stripe_payment_intent_id text UNIQUE,idempotency_key text UNIQUE NOT NULL,
 status text NOT NULL CHECK(status IN
  ('created','requires_action','processing','succeeded','failed','cancelled','refunded')),
 created_at timestamptz NOT NULL DEFAULT now(),settled_at timestamptz);
CREATE TABLE public.stripe_events(
 id text PRIMARY KEY,event_type text NOT NULL,payload_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('received','processed','failed')),
 received_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz);
CREATE TABLE public.sales_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 sales_user_id uuid NOT NULL REFERENCES public.app_users(id),
 effective_from timestamptz NOT NULL,effective_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.commission_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid REFERENCES public.stations(id),
 sales_user_id uuid REFERENCES public.app_users(id),
 mode text NOT NULL CHECK(mode IN ('fixed','percent')),
 amount numeric NOT NULL,payout_policy text NOT NULL CHECK(payout_policy IN ('monthly','upfront')),
 effective_from timestamptz NOT NULL,effective_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());

INSERT INTO public.app_users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.organizations(id,name) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Station Org A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Station Org B');
INSERT INTO public.stations(id,organization_id,name,timezone) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A1','Asia/Bangkok'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B1','Asia/Bangkok');
INSERT INTO public.memberships(user_id,active,scope_type,role_code,organization_id)
 VALUES
 ('11111111-1111-4111-8111-111111111111',true,'platform','platform_superadmin',null),
 ('22222222-2222-4222-8222-222222222222',true,'organization','organization_owner',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.station_modules(station_id,module_code,status) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','qr_coupon','enabled'),
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','hr_payroll','enabled'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','qr_coupon','enabled');
