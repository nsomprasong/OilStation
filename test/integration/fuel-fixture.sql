-- Disposable PostgreSQL schema approximating verified live fuel financial columns.
-- Do not point this fixture at the real Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(
 id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,
 file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(bucket_id text NOT NULL REFERENCES storage.buckets(id),
 name text NOT NULL,PRIMARY KEY(bucket_id,name));
CREATE TABLE public.app_users(id uuid PRIMARY KEY);
CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.stations(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES public.organizations(id),
 name text NOT NULL);
CREATE TABLE public.corporate_companies(id uuid PRIMARY KEY,name text NOT NULL DEFAULT 'Fixture Corporation');
CREATE TABLE public.memberships(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.app_users(id),
 active boolean NOT NULL DEFAULT true,scope_type text NOT NULL,role_code text NOT NULL,
 corporate_company_id uuid,station_id uuid,organization_id uuid,
 extra_permissions jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE public.corporate_station_accounts(
 id uuid PRIMARY KEY,station_id uuid NOT NULL REFERENCES public.stations(id),
 company_id uuid NOT NULL REFERENCES public.corporate_companies(id),
 prepaid_balance_satang bigint NOT NULL DEFAULT 0 CHECK(prepaid_balance_satang>=0),
 credit_limit_satang bigint NOT NULL DEFAULT 0 CHECK(credit_limit_satang>=0),
 debt_outstanding_satang bigint NOT NULL DEFAULT 0 CHECK(debt_outstanding_satang>=0),
 reserved_satang bigint NOT NULL DEFAULT 0 CHECK(reserved_satang>=0),
 payment_terms_days integer NOT NULL DEFAULT 30,
 CHECK(reserved_satang<=greatest(0,prepaid_balance_satang+credit_limit_satang-debt_outstanding_satang)),
 UNIQUE(id,station_id));
CREATE TABLE public.station_modules(
 station_id uuid NOT NULL REFERENCES public.stations(id),module_code text NOT NULL,
 status text NOT NULL,valid_from timestamptz,valid_until timestamptz,
 PRIMARY KEY(station_id,module_code));
-- A station product's display name can resolve through a linked brand product.
CREATE TABLE public.brand_fuel_products(id uuid PRIMARY KEY,name_th text NOT NULL);
CREATE TABLE public.station_fuel_products(
 id uuid PRIMARY KEY,station_id uuid NOT NULL REFERENCES public.stations(id),
 brand_product_id uuid,custom_name text, name_override text,enabled boolean NOT NULL DEFAULT false,
 current_public_price numeric,UNIQUE(id,station_id));
CREATE TABLE public.request_idempotency(
 scope_key text NOT NULL,idempotency_key text NOT NULL,request_hash text NOT NULL,
 response_snapshot jsonb,expires_at timestamptz NOT NULL,PRIMARY KEY(scope_key,idempotency_key));
CREATE TABLE public.coupons(
 id uuid PRIMARY KEY,account_id uuid NOT NULL,station_id uuid NOT NULL,
 station_fuel_id uuid,issued_by uuid REFERENCES public.app_users(id),
 plate_snapshot text,max_amount_satang bigint NOT NULL CHECK(max_amount_satang>0),
 secret_link_hash text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'reserved'
   CHECK(status IN ('reserved','verified','fueling','completed','cancelled','expired')),
 expires_at timestamptz NOT NULL,issued_at timestamptz NOT NULL DEFAULT now(),
 cancelled_at timestamptz,completed_at timestamptz,replaces_coupon_id uuid REFERENCES public.coupons(id),
 FOREIGN KEY(account_id,station_id) REFERENCES public.corporate_station_accounts(id,station_id),
 FOREIGN KEY(station_fuel_id,station_id) REFERENCES public.station_fuel_products(id,station_id));
CREATE TABLE public.coupon_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coupon_id uuid NOT NULL REFERENCES public.coupons(id),
 version_number int NOT NULL,qr_payload_hash text NOT NULL UNIQUE,
 issued_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 UNIQUE(coupon_id,version_number));
CREATE TABLE public.credit_reservations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),coupon_id uuid NOT NULL UNIQUE REFERENCES public.coupons(id),
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 amount_satang bigint NOT NULL CHECK(amount_satang>0),consumed_satang bigint NOT NULL DEFAULT 0,
 released_satang bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'held'
  CHECK(status IN ('held','settled','released')),
 closed_at timestamptz,CHECK(consumed_satang>=0 AND released_satang>=0 AND
  consumed_satang+released_satang<=amount_satang));
CREATE TABLE public.wallet_ledger(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 entry_type text NOT NULL,delta_prepaid_satang bigint NOT NULL DEFAULT 0,
 delta_debt_satang bigint NOT NULL DEFAULT 0,delta_reserved_satang bigint NOT NULL DEFAULT 0,
 reference_type text NOT NULL,reference_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,entry_type,reference_type,reference_id));
CREATE TABLE public.fuel_price_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_fuel_id uuid NOT NULL,
 public_price numeric NOT NULL,effective_at timestamptz NOT NULL);
CREATE TABLE public.fuel_price_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_fuel_id uuid NOT NULL,
 new_price numeric NOT NULL,effective_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending');
CREATE TABLE public.corporate_price_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 station_fuel_id uuid NOT NULL,rule_type text NOT NULL CHECK(rule_type IN ('fixed','discount')),
 value_per_liter numeric NOT NULL,effective_from timestamptz NOT NULL,
 effective_to timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.fuel_sessions(
 id uuid PRIMARY KEY,coupon_id uuid NOT NULL UNIQUE REFERENCES public.coupons(id),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 station_fuel_id uuid NOT NULL REFERENCES public.station_fuel_products(id),
 operator_id uuid REFERENCES public.app_users(id),status text NOT NULL DEFAULT 'fueling',
 plate_verified_at timestamptz,plate_verified_by uuid REFERENCES public.app_users(id),
 started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 locked_public_price numeric NOT NULL,locked_net_price numeric NOT NULL,
 liters numeric,pump_gross_satang bigint,net_amount_satang bigint);
CREATE TABLE public.fuel_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.fuel_sessions(id),
 kind text NOT NULL CHECK(kind IN ('plate','pump_display','receipt','other')),
 storage_path text NOT NULL,ocr_result jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.accounts_receivable(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 amount_satang bigint NOT NULL CHECK(amount_satang>0),
 outstanding_satang bigint NOT NULL,
 due_at timestamptz,fuel_session_id uuid REFERENCES public.fuel_sessions(id),
 created_at timestamptz NOT NULL DEFAULT now());

INSERT INTO public.app_users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444'),
 ('55555555-5555-4555-8555-555555555555');
INSERT INTO public.organizations VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.stations VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test station A'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Test station B');
INSERT INTO public.corporate_companies VALUES('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'),
 ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
INSERT INTO public.memberships(user_id,scope_type,role_code,corporate_company_id,station_id)
 VALUES('11111111-1111-4111-8111-111111111111','corporate_company','corporate_admin',
   'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',NULL),
 ('22222222-2222-4222-8222-222222222222','station','attendant',NULL,
   'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
 ('33333333-3333-4333-8333-333333333333','station','manager',NULL,
   'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
 ('44444444-4444-4444-8444-444444444444','station','manager',NULL,
   'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'),
 ('55555555-5555-4555-8555-555555555555','corporate_company','corporate_admin',
   'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',NULL);
INSERT INTO public.corporate_station_accounts(id,station_id,company_id,
 prepaid_balance_satang,credit_limit_satang)
 VALUES('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
        'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',10000,50000),
 ('bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
        'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',20000,0);
INSERT INTO public.station_modules(station_id,module_code,status) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','qr_coupon','enabled'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','qr_coupon','enabled');
INSERT INTO public.station_fuel_products(id,station_id,custom_name,enabled,current_public_price) VALUES
 ('aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'Gasohol 95',true,40.0000),
 ('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
  'Diesel B',true,32.0000);
INSERT INTO public.corporate_price_rules(account_id,station_fuel_id,rule_type,value_per_liter,effective_from)
 VALUES('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
        'aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','discount',5.0,'2026-01-01T00:00:00Z');

-- A second wallet of the SAME company at station B allows lawful cross-station
-- replacement while B's unrelated corporate wallet stays fully isolated.
INSERT INTO public.corporate_station_accounts(id,station_id,company_id,
 prepaid_balance_satang,credit_limit_satang)
VALUES('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb',
 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',5000,20000);

-- Bank metadata and top-up storage are separate from wallet funds.
CREATE TABLE public.station_bank_accounts(
 id uuid PRIMARY KEY,station_id uuid NOT NULL REFERENCES public.stations(id),
 bank_code text NOT NULL,account_name text NOT NULL,
 account_number_encrypted text NOT NULL,account_number_masked text,
 is_primary boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.topup_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.corporate_station_accounts(id),
 station_bank_id uuid REFERENCES public.station_bank_accounts(id),
 amount_satang bigint NOT NULL CHECK(amount_satang>0),
 slip_storage_path text,bank_reference text,
 status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')),
 requested_by uuid REFERENCES public.app_users(id),
 reviewed_by uuid REFERENCES public.app_users(id),
 reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.audit_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES public.app_users(id),
 station_id uuid,organization_id uuid,entity_type text NOT NULL,entity_id text,
 action text NOT NULL,before_state jsonb,after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.station_bank_accounts(id,station_id,bank_code,account_name,
 account_number_encrypted,account_number_masked)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-555555555555',
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','KBANK','Test Station A',
  'fixture-only-ciphertext','***1234'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-555555555555',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','SCB','Test Station B',
  'fixture-only-ciphertext','***9876');
