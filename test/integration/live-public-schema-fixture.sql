-- Generated from read-only metadata: the existing public schema, no customer rows.
-- OilStation live baseline snapshot 2026-10-29. Not a production backup.
-- Does not include live functions, triggers, storage/auth schemas or role grants.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,PRIMARY KEY(bucket_id,name));
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public."accounts_receivable" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "amount_satang" bigint NOT NULL,
  "outstanding_satang" bigint NOT NULL,
  "due_at" timestamp with time zone,
  "fuel_session_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."advance_repayments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "advance_id" uuid NOT NULL,
  "payroll_line_id" uuid NOT NULL,
  "amount_satang" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."app_users" (
  "id" uuid NOT NULL,
  "display_name" text,
  "email" text,
  "phone" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."ar_statements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "due_date" date NOT NULL,
  "total_satang" bigint NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."attendance_adjustments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "original_event_id" uuid,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "corrected_time" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone
);
CREATE TABLE public."attendance_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "shift_assignment_id" uuid,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "accuracy_meters" numeric(10,2),
  "photo_path" text,
  "face_confidence" numeric(5,4),
  "geofence_status" text,
  "review_status" text DEFAULT 'accepted'::text NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."audit_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "actor_id" uuid,
  "station_id" uuid,
  "organization_id" uuid,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "action" text NOT NULL,
  "before_state" jsonb,
  "after_state" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."bank_export_batches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "payroll_run_id" uuid NOT NULL,
  "station_bank_account_id" uuid NOT NULL,
  "adapter_code" text NOT NULL,
  "file_path" text NOT NULL,
  "status" text DEFAULT 'exported'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."billing_group_stations" (
  "billing_group_id" uuid NOT NULL,
  "station_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."billing_groups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "autopay_consent" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."biometric_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "encrypted_template" bytea NOT NULL,
  "consent_basis" text NOT NULL,
  "retention_until" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."brand_fuel_products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "brand_id" uuid NOT NULL,
  "code" text NOT NULL,
  "name_th" text NOT NULL,
  "name_en" text,
  "fuel_family" text NOT NULL,
  "verification_status" text DEFAULT 'review_required'::text NOT NULL,
  "source_url" text,
  "last_verified_at" timestamp with time zone,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE public."commission_entitlements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "sales_user_id" uuid NOT NULL,
  "invoice_line_id" uuid NOT NULL,
  "service_period_start" date NOT NULL,
  "service_period_end" date NOT NULL,
  "amount_satang" bigint NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL
);
CREATE TABLE public."commission_ledger" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "sales_user_id" uuid NOT NULL,
  "station_id" uuid,
  "entitlement_id" uuid,
  "amount_satang" bigint NOT NULL,
  "entry_type" text NOT NULL,
  "reference_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."commission_payouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sales_user_id" uuid NOT NULL,
  "amount_satang" bigint NOT NULL,
  "payment_period" date NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "paid_at" timestamp with time zone,
  "evidence_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."commission_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid,
  "sales_user_id" uuid,
  "mode" text NOT NULL,
  "amount" numeric(12,4) NOT NULL,
  "payout_policy" text NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."corporate_companies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "tax_id" text,
  "contact_email" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."corporate_drivers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "display_name" text NOT NULL,
  "phone" text,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE public."corporate_price_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "station_fuel_id" uuid NOT NULL,
  "rule_type" text NOT NULL,
  "value_per_liter" numeric(12,4) NOT NULL,
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "effective_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."corporate_station_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "prepaid_balance_satang" bigint DEFAULT 0 NOT NULL,
  "credit_limit_satang" bigint DEFAULT 0 NOT NULL,
  "debt_outstanding_satang" bigint DEFAULT 0 NOT NULL,
  "reserved_satang" bigint DEFAULT 0 NOT NULL,
  "due_mode" text DEFAULT 'per_fill'::text NOT NULL,
  "payment_terms_days" integer DEFAULT 30 NOT NULL,
  "statement_close_day" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."corporate_station_link_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "requested_by" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."corporate_vehicles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "plate_number" text NOT NULL,
  "province" text,
  "description" text,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE public."coupon_photo_checks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "station_id" uuid NOT NULL,
  "photo_path" text NOT NULL,
  "captured_by" uuid NOT NULL,
  "observed_plate" text,
  "decision" text NOT NULL,
  "checked_by" uuid,
  "checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."coupon_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "qr_payload_hash" text NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
CREATE TABLE public."coupons" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "station_id" uuid NOT NULL,
  "station_fuel_id" uuid,
  "issued_by" uuid,
  "driver_id" uuid,
  "vehicle_id" uuid,
  "plate_snapshot" text,
  "max_amount_satang" bigint NOT NULL,
  "secret_link_hash" text NOT NULL,
  "status" text DEFAULT 'reserved'::text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cancelled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "replaces_coupon_id" uuid
);
CREATE TABLE public."credit_reservations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "amount_satang" bigint NOT NULL,
  "consumed_satang" bigint DEFAULT 0 NOT NULL,
  "released_satang" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'held'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone
);
CREATE TABLE public."employee_payment_methods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "payment_type" text NOT NULL,
  "encrypted_reference" bytea NOT NULL,
  "masked_reference" text NOT NULL,
  "bank_code" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "verified_name" text,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."employees" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "user_id" uuid,
  "employee_code" text NOT NULL,
  "display_name" text NOT NULL,
  "hired_on" date,
  "employment_status" text DEFAULT 'active'::text NOT NULL,
  "wage_type" text,
  "wage_satang" bigint,
  "payroll_frequency" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."fuel_brands" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "display_name_th" text NOT NULL,
  "display_name_en" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."fuel_evidence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "storage_path" text NOT NULL,
  "ocr_result" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."fuel_price_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_fuel_id" uuid NOT NULL,
  "new_price" numeric(12,4) NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "applied_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."fuel_price_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_fuel_id" uuid NOT NULL,
  "public_price" numeric(12,4) NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."fuel_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "coupon_id" uuid NOT NULL,
  "station_id" uuid NOT NULL,
  "station_fuel_id" uuid NOT NULL,
  "operator_id" uuid,
  "status" text DEFAULT 'fueling'::text NOT NULL,
  "plate_verified_at" timestamp with time zone,
  "plate_verified_by" uuid,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "locked_public_price" numeric(12,4) NOT NULL,
  "locked_net_price" numeric(12,4) NOT NULL,
  "liters" numeric(14,3),
  "pump_gross_satang" bigint,
  "net_amount_satang" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."invitations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "role_code" text NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scope_type" text NOT NULL,
  "organization_id" uuid,
  "station_id" uuid,
  "corporate_company_id" uuid,
  "invited_by" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."leave_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "leave_type" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."memberships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role_code" text NOT NULL,
  "scope_type" text NOT NULL,
  "organization_id" uuid,
  "station_id" uuid,
  "corporate_company_id" uuid,
  "extra_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."notification_outbox" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "recipient_user_id" uuid,
  "station_id" uuid,
  "channel" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."organizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "tax_id" text,
  "timezone" text DEFAULT 'Asia/Bangkok'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."overtime_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "shift_assignment_id" uuid,
  "planned" boolean DEFAULT false NOT NULL,
  "requested_minutes" integer NOT NULL,
  "approved_minutes" integer,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reason" text,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."payment_method_consents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "billing_group_id" uuid NOT NULL,
  "stripe_payment_method_id" text NOT NULL,
  "consented_by" uuid,
  "active" boolean DEFAULT true NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "consent_text_version" text NOT NULL
);
CREATE TABLE public."payroll_adjustments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "source_period_id" uuid NOT NULL,
  "target_period_id" uuid,
  "amount_satang" bigint NOT NULL,
  "reason" text NOT NULL,
  "approved_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."payroll_lines" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "payroll_run_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "gross_satang" bigint DEFAULT 0 NOT NULL,
  "tax_satang" bigint DEFAULT 0 NOT NULL,
  "social_security_satang" bigint DEFAULT 0 NOT NULL,
  "deductions_satang" bigint DEFAULT 0 NOT NULL,
  "adjustments_satang" bigint DEFAULT 0 NOT NULL,
  "net_satang" bigint DEFAULT 0 NOT NULL,
  "breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public."payroll_payouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "payroll_line_id" uuid NOT NULL,
  "payment_method_id" uuid,
  "station_bank_account_id" uuid,
  "amount_satang" bigint NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "transfer_reference" text,
  "evidence_path" text,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."payroll_periods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "starts_on" date NOT NULL,
  "ends_on" date NOT NULL,
  "frequency" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "locked_at" timestamp with time zone
);
CREATE TABLE public."payroll_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "payroll_period_id" uuid NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."pricing_plans" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "billing_frequency" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."pricing_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "module_code" text,
  "billing_method" text NOT NULL,
  "price_satang" bigint NOT NULL,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE TABLE public."promotions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text,
  "title" text NOT NULL,
  "discount_type" text NOT NULL,
  "discount_value" numeric(12,2) NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE public."request_idempotency" (
  "scope_key" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_snapshot" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
CREATE TABLE public."saas_invoice_lines" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "station_id" uuid NOT NULL,
  "module_code" text,
  "description" text NOT NULL,
  "quantity" numeric(12,3) DEFAULT 1 NOT NULL,
  "amount_satang" bigint NOT NULL,
  "discount_satang" bigint DEFAULT 0 NOT NULL,
  "price_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public."saas_invoices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "billing_group_id" uuid NOT NULL,
  "invoice_number" text NOT NULL,
  "subtotal_satang" bigint NOT NULL,
  "discount_satang" bigint DEFAULT 0 NOT NULL,
  "tax_satang" bigint DEFAULT 0 NOT NULL,
  "total_satang" bigint NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "issued_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "pricing_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."saas_payment_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "payment_method" text NOT NULL,
  "amount_satang" bigint NOT NULL,
  "stripe_payment_intent_id" text,
  "idempotency_key" text NOT NULL,
  "status" text DEFAULT 'created'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "settled_at" timestamp with time zone
);
CREATE TABLE public."salary_advances" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "principal_satang" bigint NOT NULL,
  "outstanding_satang" bigint NOT NULL,
  "repayment_satang" bigint NOT NULL,
  "start_period_policy" text NOT NULL,
  "status" text DEFAULT 'requested'::text NOT NULL,
  "approved_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."sales_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "sales_user_id" uuid NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_until" timestamp with time zone,
  "assigned_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."shift_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "shift_template_id" uuid NOT NULL,
  "shift_date" date NOT NULL,
  "status" text DEFAULT 'scheduled'::text NOT NULL,
  "replacement_of" uuid,
  "approved_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."shift_change_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "original_assignment_id" uuid,
  "replacement_assignment_id" uuid,
  "request_type" text NOT NULL,
  "reason" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "requested_by" uuid
);
CREATE TABLE public."shift_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "name" text NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "default_break_minutes" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE public."station_bank_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "bank_code" text NOT NULL,
  "account_name" text NOT NULL,
  "account_number_encrypted" text NOT NULL,
  "account_number_masked" text,
  "is_primary" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."station_fuel_products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "brand_product_id" uuid,
  "custom_name" text,
  "name_override" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "current_public_price" numeric(12,4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."station_modules" (
  "station_id" uuid NOT NULL,
  "module_code" text NOT NULL,
  "status" text DEFAULT 'disabled'::text NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone
);
CREATE TABLE public."station_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "station_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "current_period_end" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'trialing'::text NOT NULL,
  "price_override_satang" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "brand_id" uuid,
  "name" text NOT NULL,
  "timezone" text DEFAULT 'Asia/Bangkok'::text NOT NULL,
  "address" text,
  "latitude" numeric(10,7),
  "longitude" numeric(10,7),
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."stripe_events" (
  "id" text NOT NULL,
  "event_type" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "payload_hash" text NOT NULL,
  "status" text DEFAULT 'received'::text NOT NULL
);
CREATE TABLE public."topup_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "station_bank_id" uuid,
  "amount_satang" bigint NOT NULL,
  "slip_storage_path" text,
  "bank_reference" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "requested_by" uuid,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."wallet_ledger" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "account_id" uuid NOT NULL,
  "entry_type" text NOT NULL,
  "delta_prepaid_satang" bigint DEFAULT 0 NOT NULL,
  "delta_debt_satang" bigint DEFAULT 0 NOT NULL,
  "delta_reserved_satang" bigint DEFAULT 0 NOT NULL,
  "reference_type" text NOT NULL,
  "reference_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."accounts_receivable" ADD CONSTRAINT "accounts_receivable_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."accounts_receivable" ADD CONSTRAINT "accounts_receivable_check" CHECK (((outstanding_satang >= 0) AND (outstanding_satang <= amount_satang)));
ALTER TABLE public."accounts_receivable" ADD CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY (id);
ALTER TABLE public."advance_repayments" ADD CONSTRAINT "advance_repayments_advance_id_payroll_line_id_key" UNIQUE (advance_id, payroll_line_id);
ALTER TABLE public."advance_repayments" ADD CONSTRAINT "advance_repayments_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."advance_repayments" ADD CONSTRAINT "advance_repayments_pkey" PRIMARY KEY (id);
ALTER TABLE public."app_users" ADD CONSTRAINT "app_users_pkey" PRIMARY KEY (id);
ALTER TABLE public."ar_statements" ADD CONSTRAINT "ar_statements_account_id_period_start_period_end_key" UNIQUE (account_id, period_start, period_end);
ALTER TABLE public."ar_statements" ADD CONSTRAINT "ar_statements_check" CHECK ((period_end >= period_start));
ALTER TABLE public."ar_statements" ADD CONSTRAINT "ar_statements_pkey" PRIMARY KEY (id);
ALTER TABLE public."ar_statements" ADD CONSTRAINT "ar_statements_total_satang_check" CHECK ((total_satang >= 0));
ALTER TABLE public."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."attendance_events" ADD CONSTRAINT "attendance_events_event_type_check" CHECK ((event_type = ANY (ARRAY['clock_in'::text, 'clock_out'::text, 'break_start'::text, 'break_end'::text])));
ALTER TABLE public."attendance_events" ADD CONSTRAINT "attendance_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."attendance_events" ADD CONSTRAINT "attendance_events_review_status_check" CHECK ((review_status = ANY (ARRAY['accepted'::text, 'pending'::text, 'rejected'::text])));
ALTER TABLE public."audit_events" ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."bank_export_batches" ADD CONSTRAINT "bank_export_batches_pkey" PRIMARY KEY (id);
ALTER TABLE public."bank_export_batches" ADD CONSTRAINT "bank_export_batches_status_check" CHECK ((status = ANY (ARRAY['exported'::text, 'submitted'::text, 'reconciled'::text, 'failed'::text])));
ALTER TABLE public."billing_group_stations" ADD CONSTRAINT "billing_group_stations_pkey" PRIMARY KEY (billing_group_id, station_id);
ALTER TABLE public."billing_group_stations" ADD CONSTRAINT "billing_group_stations_station_id_key" UNIQUE (station_id);
ALTER TABLE public."billing_groups" ADD CONSTRAINT "billing_groups_pkey" PRIMARY KEY (id);
ALTER TABLE public."biometric_templates" ADD CONSTRAINT "biometric_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."brand_fuel_products" ADD CONSTRAINT "brand_fuel_products_brand_id_code_key" UNIQUE (brand_id, code);
ALTER TABLE public."brand_fuel_products" ADD CONSTRAINT "brand_fuel_products_pkey" PRIMARY KEY (id);
ALTER TABLE public."brand_fuel_products" ADD CONSTRAINT "brand_fuel_products_verification_status_check" CHECK ((verification_status = ANY (ARRAY['official_confirmed'::text, 'government_category'::text, 'review_required'::text, 'retired'::text])));
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_check" CHECK ((service_period_end >= service_period_start));
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_pkey" PRIMARY KEY (id);
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_station_id_sales_user_id_invoice_li_key" UNIQUE (station_id, sales_user_id, invoice_line_id, service_period_start, service_period_end);
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'earned'::text, 'reversed'::text, 'paid'::text])));
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_entry_type_check" CHECK ((entry_type = ANY (ARRAY['earned'::text, 'paid'::text, 'reversal'::text, 'clawback'::text, 'recovery'::text])));
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_pkey" PRIMARY KEY (id);
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_reference_key_key" UNIQUE (reference_key);
ALTER TABLE public."commission_payouts" ADD CONSTRAINT "commission_payouts_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."commission_payouts" ADD CONSTRAINT "commission_payouts_pkey" PRIMARY KEY (id);
ALTER TABLE public."commission_payouts" ADD CONSTRAINT "commission_payouts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'failed'::text])));
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_mode_check" CHECK ((mode = ANY (ARRAY['fixed'::text, 'percent'::text])));
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_payout_policy_check" CHECK ((payout_policy = ANY (ARRAY['monthly'::text, 'upfront'::text])));
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_companies" ADD CONSTRAINT "corporate_companies_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_drivers" ADD CONSTRAINT "corporate_drivers_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_check" CHECK (((effective_to IS NULL) OR (effective_to > effective_from)));
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_rule_type_check" CHECK ((rule_type = ANY (ARRAY['fixed'::text, 'discount'::text])));
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_value_per_liter_check" CHECK ((value_per_liter >= (0)::numeric));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_check" CHECK ((reserved_satang <= GREATEST((0)::bigint, ((prepaid_balance_satang + credit_limit_satang) - debt_outstanding_satang))));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_credit_limit_satang_check" CHECK ((credit_limit_satang >= 0));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_debt_outstanding_satang_check" CHECK ((debt_outstanding_satang >= 0));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_due_mode_check" CHECK ((due_mode = ANY (ARRAY['per_fill'::text, 'statement'::text])));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_id_station_id_key" UNIQUE (id, station_id);
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_payment_terms_days_check" CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365)));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_prepaid_balance_satang_check" CHECK ((prepaid_balance_satang >= 0));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_reserved_satang_check" CHECK ((reserved_satang >= 0));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_statement_close_day_check" CHECK (((statement_close_day >= 1) AND (statement_close_day <= 31)));
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_station_id_company_id_key" UNIQUE (station_id, company_id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_station_id_company_id_key" UNIQUE (station_id, company_id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public."corporate_vehicles" ADD CONSTRAINT "corporate_vehicles_pkey" PRIMARY KEY (id);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_check_path_unique" UNIQUE (coupon_id, photo_path);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_check_review_state" CHECK ((((decision = 'pending'::text) AND (checked_at IS NULL)) OR ((decision <> 'pending'::text) AND (checked_at IS NOT NULL))));
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_decision_check" CHECK ((decision = ANY (ARRAY['pending'::text, 'verified_ocr'::text, 'verified_supervisor'::text, 'rejected'::text])));
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_pkey" PRIMARY KEY (id);
ALTER TABLE public."coupon_versions" ADD CONSTRAINT "coupon_versions_coupon_id_version_number_key" UNIQUE (coupon_id, version_number);
ALTER TABLE public."coupon_versions" ADD CONSTRAINT "coupon_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public."coupon_versions" ADD CONSTRAINT "coupon_versions_qr_payload_hash_key" UNIQUE (qr_payload_hash);
ALTER TABLE public."coupon_versions" ADD CONSTRAINT "coupon_versions_version_number_check" CHECK ((version_number > 0));
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_max_amount_satang_check" CHECK ((max_amount_satang > 0));
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_pkey" PRIMARY KEY (id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_secret_link_hash_key" UNIQUE (secret_link_hash);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_status_check" CHECK ((status = ANY (ARRAY['reserved'::text, 'verified'::text, 'fueling'::text, 'completed'::text, 'cancelled'::text, 'expired'::text])));
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_check" CHECK (((consumed_satang + released_satang) <= amount_satang));
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_consumed_satang_check" CHECK ((consumed_satang >= 0));
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_coupon_id_key" UNIQUE (coupon_id);
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_pkey" PRIMARY KEY (id);
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_released_satang_check" CHECK ((released_satang >= 0));
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_status_check" CHECK ((status = ANY (ARRAY['held'::text, 'settled'::text, 'released'::text])));
ALTER TABLE public."employee_payment_methods" ADD CONSTRAINT "employee_payment_methods_payment_type_check" CHECK ((payment_type = ANY (ARRAY['promptpay_phone'::text, 'promptpay_national_id'::text, 'bank_account'::text])));
ALTER TABLE public."employee_payment_methods" ADD CONSTRAINT "employee_payment_methods_pkey" PRIMARY KEY (id);
ALTER TABLE public."employee_payment_methods" ADD CONSTRAINT "employee_payment_methods_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."employees" ADD CONSTRAINT "employees_id_station_id_key" UNIQUE (id, station_id);
ALTER TABLE public."employees" ADD CONSTRAINT "employees_payroll_frequency_check" CHECK ((payroll_frequency = ANY (ARRAY['weekly'::text, 'semi_monthly'::text, 'monthly'::text])));
ALTER TABLE public."employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);
ALTER TABLE public."employees" ADD CONSTRAINT "employees_station_id_employee_code_key" UNIQUE (station_id, employee_code);
ALTER TABLE public."employees" ADD CONSTRAINT "employees_wage_satang_check" CHECK ((wage_satang >= 0));
ALTER TABLE public."employees" ADD CONSTRAINT "employees_wage_type_check" CHECK ((wage_type = ANY (ARRAY['monthly'::text, 'daily'::text, 'hourly'::text])));
ALTER TABLE public."fuel_brands" ADD CONSTRAINT "fuel_brands_code_key" UNIQUE (code);
ALTER TABLE public."fuel_brands" ADD CONSTRAINT "fuel_brands_pkey" PRIMARY KEY (id);
ALTER TABLE public."fuel_evidence" ADD CONSTRAINT "fuel_evidence_kind_check" CHECK ((kind = ANY (ARRAY['plate'::text, 'pump_display'::text, 'receipt'::text, 'other'::text])));
ALTER TABLE public."fuel_evidence" ADD CONSTRAINT "fuel_evidence_pkey" PRIMARY KEY (id);
ALTER TABLE public."fuel_price_schedules" ADD CONSTRAINT "fuel_price_schedules_new_price_check" CHECK ((new_price > (0)::numeric));
ALTER TABLE public."fuel_price_schedules" ADD CONSTRAINT "fuel_price_schedules_pkey" PRIMARY KEY (id);
ALTER TABLE public."fuel_price_schedules" ADD CONSTRAINT "fuel_price_schedules_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'cancelled'::text, 'failed'::text])));
ALTER TABLE public."fuel_price_versions" ADD CONSTRAINT "fuel_price_versions_pkey" PRIMARY KEY (id);
ALTER TABLE public."fuel_price_versions" ADD CONSTRAINT "fuel_price_versions_public_price_check" CHECK ((public_price > (0)::numeric));
ALTER TABLE public."fuel_price_versions" ADD CONSTRAINT "fuel_price_versions_station_fuel_id_effective_at_key" UNIQUE (station_fuel_id, effective_at);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_coupon_id_key" UNIQUE (coupon_id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_liters_check" CHECK ((liters >= (0)::numeric));
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_locked_net_price_check" CHECK ((locked_net_price >= (0)::numeric));
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_locked_public_price_check" CHECK ((locked_public_price > (0)::numeric));
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_net_amount_satang_check" CHECK ((net_amount_satang >= 0));
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_pump_gross_satang_check" CHECK ((pump_gross_satang >= 0));
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_status_check" CHECK ((status = ANY (ARRAY['fueling'::text, 'review'::text, 'completed'::text, 'void'::text])));
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_pkey" PRIMARY KEY (id);
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_scope_type_check" CHECK ((scope_type = ANY (ARRAY['platform'::text, 'organization'::text, 'station'::text, 'corporate_company'::text])));
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_token_hash_key" UNIQUE (token_hash);
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_check" CHECK ((end_date >= start_date));
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_check" CHECK ((((scope_type = 'platform'::text) AND (organization_id IS NULL) AND (station_id IS NULL) AND (corporate_company_id IS NULL)) OR ((scope_type = 'organization'::text) AND (organization_id IS NOT NULL) AND (station_id IS NULL) AND (corporate_company_id IS NULL)) OR ((scope_type = 'station'::text) AND (station_id IS NOT NULL) AND (organization_id IS NULL) AND (corporate_company_id IS NULL)) OR ((scope_type = 'corporate_company'::text) AND (corporate_company_id IS NOT NULL) AND (station_id IS NULL) AND (organization_id IS NULL))));
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_extra_permissions_check" CHECK ((jsonb_typeof(extra_permissions) = 'object'::text));
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_pkey" PRIMARY KEY (id);
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_scope_type_check" CHECK ((scope_type = ANY (ARRAY['platform'::text, 'organization'::text, 'station'::text, 'corporate_company'::text])));
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_attempts_check" CHECK ((attempts >= 0));
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_channel_check" CHECK ((channel = ANY (ARRAY['in_app'::text, 'email'::text, 'line'::text, 'sms'::text])));
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_pkey" PRIMARY KEY (id);
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])));
ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY (id);
ALTER TABLE public."organizations" ADD CONSTRAINT "organizations_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])));
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_approved_minutes_check" CHECK ((approved_minutes >= 0));
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_check" CHECK (((approved_minutes IS NULL) OR (approved_minutes <= requested_minutes)));
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_requested_minutes_check" CHECK ((requested_minutes >= 0));
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'partial'::text, 'rejected'::text])));
ALTER TABLE public."payment_method_consents" ADD CONSTRAINT "payment_method_consents_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_deductions_satang_check" CHECK ((deductions_satang >= 0));
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_run_id_employee_id_key" UNIQUE (payroll_run_id, employee_id);
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_social_security_satang_check" CHECK ((social_security_satang >= 0));
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_tax_satang_check" CHECK ((tax_satang >= 0));
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'exported'::text, 'submitted'::text, 'paid'::text, 'failed'::text])));
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_check" CHECK ((ends_on >= starts_on));
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_frequency_check" CHECK ((frequency = ANY (ARRAY['weekly'::text, 'semi_monthly'::text, 'monthly'::text])));
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_station_id_starts_on_ends_on_frequency_key" UNIQUE (station_id, starts_on, ends_on, frequency);
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'locked'::text, 'closed'::text])));
ALTER TABLE public."payroll_runs" ADD CONSTRAINT "payroll_runs_pkey" PRIMARY KEY (id);
ALTER TABLE public."payroll_runs" ADD CONSTRAINT "payroll_runs_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'paying'::text, 'paid'::text, 'partial'::text, 'failed'::text])));
ALTER TABLE public."pricing_plans" ADD CONSTRAINT "pricing_plans_billing_frequency_check" CHECK ((billing_frequency = ANY (ARRAY['monthly'::text, 'yearly'::text])));
ALTER TABLE public."pricing_plans" ADD CONSTRAINT "pricing_plans_code_key" UNIQUE (code);
ALTER TABLE public."pricing_plans" ADD CONSTRAINT "pricing_plans_pkey" PRIMARY KEY (id);
ALTER TABLE public."pricing_rules" ADD CONSTRAINT "pricing_rules_billing_method_check" CHECK ((billing_method = ANY (ARRAY['flat'::text, 'per_employee'::text, 'tier'::text, 'bundle'::text])));
ALTER TABLE public."pricing_rules" ADD CONSTRAINT "pricing_rules_module_code_check" CHECK ((module_code = ANY (ARRAY['qr_coupon'::text, 'hr_payroll'::text])));
ALTER TABLE public."pricing_rules" ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY (id);
ALTER TABLE public."pricing_rules" ADD CONSTRAINT "pricing_rules_price_satang_check" CHECK ((price_satang >= 0));
ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_check" CHECK ((ends_at > starts_at));
ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_code_key" UNIQUE (code);
ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])));
ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_discount_value_check" CHECK ((discount_value >= (0)::numeric));
ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_pkey" PRIMARY KEY (id);
ALTER TABLE public."request_idempotency" ADD CONSTRAINT "request_idempotency_pkey" PRIMARY KEY (scope_key, idempotency_key);
ALTER TABLE public."saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_pkey" PRIMARY KEY (id);
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_discount_satang_check" CHECK ((discount_satang >= 0));
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_invoice_number_key" UNIQUE (invoice_number);
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_pkey" PRIMARY KEY (id);
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'pending'::text, 'paid'::text, 'overdue'::text, 'void'::text, 'refunded'::text])));
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_subtotal_satang_check" CHECK ((subtotal_satang >= 0));
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_tax_satang_check" CHECK ((tax_satang >= 0));
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_total_satang_check" CHECK ((total_satang >= 0));
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_payment_method_check" CHECK ((payment_method = ANY (ARRAY['card'::text, 'promptpay'::text])));
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_pkey" PRIMARY KEY (id);
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_status_check" CHECK ((status = ANY (ARRAY['created'::text, 'requires_action'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])));
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_stripe_payment_intent_id_key" UNIQUE (stripe_payment_intent_id);
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_check" CHECK (((outstanding_satang >= 0) AND (outstanding_satang <= principal_satang)));
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_pkey" PRIMARY KEY (id);
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_principal_satang_check" CHECK ((principal_satang > 0));
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_repayment_satang_check" CHECK ((repayment_satang > 0));
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_start_period_policy_check" CHECK ((start_period_policy = ANY (ARRAY['next'::text, 'following'::text])));
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_status_check" CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'repaid'::text])));
ALTER TABLE public."sales_assignments" ADD CONSTRAINT "sales_assignments_check" CHECK (((effective_until IS NULL) OR (effective_until > effective_from)));
ALTER TABLE public."sales_assignments" ADD CONSTRAINT "sales_assignments_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'replaced'::text, 'worked'::text, 'cancelled'::text, 'absence_review'::text])));
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_request_type_check" CHECK ((request_type = ANY (ARRAY['swap'::text, 'replace'::text, 'double_shift'::text, 'correction'::text])));
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_default_break_minutes_check" CHECK (((default_break_minutes >= 0) AND (default_break_minutes <= 480)));
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."station_bank_accounts" ADD CONSTRAINT "station_bank_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_check" CHECK (((brand_product_id IS NOT NULL) OR (NULLIF(btrim(custom_name), ''::text) IS NOT NULL)));
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_check1" CHECK (((NOT enabled) OR (current_public_price IS NOT NULL)));
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_current_public_price_check" CHECK ((current_public_price > (0)::numeric));
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_id_station_id_key" UNIQUE (id, station_id);
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_pkey" PRIMARY KEY (id);
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_station_id_brand_product_id_key" UNIQUE (station_id, brand_product_id);
ALTER TABLE public."station_modules" ADD CONSTRAINT "station_modules_module_code_check" CHECK ((module_code = ANY (ARRAY['qr_coupon'::text, 'hr_payroll'::text])));
ALTER TABLE public."station_modules" ADD CONSTRAINT "station_modules_pkey" PRIMARY KEY (station_id, module_code);
ALTER TABLE public."station_modules" ADD CONSTRAINT "station_modules_status_check" CHECK ((status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'grace'::text, 'suspended'::text])));
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_check" CHECK ((current_period_end > starts_at));
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_price_override_satang_check" CHECK ((price_override_satang >= 0));
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_status_check" CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'overdue'::text, 'grace'::text, 'suspended'::text, 'cancelled'::text])));
ALTER TABLE public."stations" ADD CONSTRAINT "stations_id_organization_id_key" UNIQUE (id, organization_id);
ALTER TABLE public."stations" ADD CONSTRAINT "stations_pkey" PRIMARY KEY (id);
ALTER TABLE public."stripe_events" ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."stripe_events" ADD CONSTRAINT "stripe_events_status_check" CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text])));
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_amount_satang_check" CHECK ((amount_satang > 0));
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."wallet_ledger" ADD CONSTRAINT "wallet_ledger_account_id_entry_type_reference_type_referenc_key" UNIQUE (account_id, entry_type, reference_type, reference_id);
ALTER TABLE public."wallet_ledger" ADD CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY (id);

ALTER TABLE public."accounts_receivable" ADD CONSTRAINT "accounts_receivable_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);
ALTER TABLE public."accounts_receivable" ADD CONSTRAINT "accounts_receivable_fuel_session_fk" FOREIGN KEY (fuel_session_id) REFERENCES fuel_sessions(id);
ALTER TABLE public."advance_repayments" ADD CONSTRAINT "advance_repayments_advance_id_fkey" FOREIGN KEY (advance_id) REFERENCES salary_advances(id);
ALTER TABLE public."advance_repayments" ADD CONSTRAINT "advance_repayments_payroll_line_id_fkey" FOREIGN KEY (payroll_line_id) REFERENCES payroll_lines(id);
ALTER TABLE public."app_users" ADD CONSTRAINT "app_users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public."ar_statements" ADD CONSTRAINT "ar_statements_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);
ALTER TABLE public."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_original_event_id_fkey" FOREIGN KEY (original_event_id) REFERENCES attendance_events(id);
ALTER TABLE public."attendance_adjustments" ADD CONSTRAINT "attendance_adjustments_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES app_users(id);
ALTER TABLE public."attendance_events" ADD CONSTRAINT "attendance_events_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."attendance_events" ADD CONSTRAINT "attendance_events_shift_assignment_id_fkey" FOREIGN KEY (shift_assignment_id) REFERENCES shift_assignments(id);
ALTER TABLE public."audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES app_users(id);
ALTER TABLE public."audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public."audit_events" ADD CONSTRAINT "audit_events_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."bank_export_batches" ADD CONSTRAINT "bank_export_batches_payroll_run_id_fkey" FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id);
ALTER TABLE public."bank_export_batches" ADD CONSTRAINT "bank_export_batches_station_bank_account_id_fkey" FOREIGN KEY (station_bank_account_id) REFERENCES station_bank_accounts(id);
ALTER TABLE public."billing_group_stations" ADD CONSTRAINT "billing_group_stations_billing_group_id_fkey" FOREIGN KEY (billing_group_id) REFERENCES billing_groups(id);
ALTER TABLE public."billing_group_stations" ADD CONSTRAINT "billing_group_stations_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."billing_groups" ADD CONSTRAINT "billing_groups_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public."biometric_templates" ADD CONSTRAINT "biometric_templates_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."brand_fuel_products" ADD CONSTRAINT "brand_fuel_products_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES fuel_brands(id);
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_invoice_line_id_fkey" FOREIGN KEY (invoice_line_id) REFERENCES saas_invoice_lines(id);
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_sales_user_id_fkey" FOREIGN KEY (sales_user_id) REFERENCES app_users(id);
ALTER TABLE public."commission_entitlements" ADD CONSTRAINT "commission_entitlements_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_entitlement_id_fkey" FOREIGN KEY (entitlement_id) REFERENCES commission_entitlements(id);
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_sales_user_id_fkey" FOREIGN KEY (sales_user_id) REFERENCES app_users(id);
ALTER TABLE public."commission_ledger" ADD CONSTRAINT "commission_ledger_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."commission_payouts" ADD CONSTRAINT "commission_payouts_sales_user_id_fkey" FOREIGN KEY (sales_user_id) REFERENCES app_users(id);
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_sales_user_id_fkey" FOREIGN KEY (sales_user_id) REFERENCES app_users(id);
ALTER TABLE public."commission_rules" ADD CONSTRAINT "commission_rules_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."corporate_drivers" ADD CONSTRAINT "corporate_drivers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."corporate_drivers" ADD CONSTRAINT "corporate_drivers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id);
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);
ALTER TABLE public."corporate_price_rules" ADD CONSTRAINT "corporate_price_rules_station_fuel_id_fkey" FOREIGN KEY (station_fuel_id) REFERENCES station_fuel_products(id);
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."corporate_station_accounts" ADD CONSTRAINT "corporate_station_accounts_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES app_users(id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES app_users(id);
ALTER TABLE public."corporate_station_link_requests" ADD CONSTRAINT "corporate_station_link_requests_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."corporate_vehicles" ADD CONSTRAINT "corporate_vehicles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_captured_by_fkey" FOREIGN KEY (captured_by) REFERENCES app_users(id);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_checked_by_fkey" FOREIGN KEY (checked_by) REFERENCES app_users(id);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES coupons(id);
ALTER TABLE public."coupon_photo_checks" ADD CONSTRAINT "coupon_photo_checks_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."coupon_versions" ADD CONSTRAINT "coupon_versions_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES coupons(id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupon_account_station_fk" FOREIGN KEY (account_id, station_id) REFERENCES corporate_station_accounts(id, station_id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupon_station_fuel_fk" FOREIGN KEY (station_fuel_id, station_id) REFERENCES station_fuel_products(id, station_id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES corporate_drivers(id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_issued_by_fkey" FOREIGN KEY (issued_by) REFERENCES app_users(id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_replaces_coupon_id_fkey" FOREIGN KEY (replaces_coupon_id) REFERENCES coupons(id);
ALTER TABLE public."coupons" ADD CONSTRAINT "coupons_vehicle_id_fkey" FOREIGN KEY (vehicle_id) REFERENCES corporate_vehicles(id);
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);
ALTER TABLE public."credit_reservations" ADD CONSTRAINT "credit_reservations_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES coupons(id);
ALTER TABLE public."employee_payment_methods" ADD CONSTRAINT "employee_payment_methods_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."employee_payment_methods" ADD CONSTRAINT "employee_payment_methods_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."employees" ADD CONSTRAINT "employees_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id);
ALTER TABLE public."fuel_evidence" ADD CONSTRAINT "fuel_evidence_session_id_fkey" FOREIGN KEY (session_id) REFERENCES fuel_sessions(id);
ALTER TABLE public."fuel_price_schedules" ADD CONSTRAINT "fuel_price_schedules_created_by_fkey" FOREIGN KEY (created_by) REFERENCES app_users(id);
ALTER TABLE public."fuel_price_schedules" ADD CONSTRAINT "fuel_price_schedules_station_fuel_id_fkey" FOREIGN KEY (station_fuel_id) REFERENCES station_fuel_products(id);
ALTER TABLE public."fuel_price_versions" ADD CONSTRAINT "fuel_price_versions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES app_users(id);
ALTER TABLE public."fuel_price_versions" ADD CONSTRAINT "fuel_price_versions_station_fuel_id_fkey" FOREIGN KEY (station_fuel_id) REFERENCES station_fuel_products(id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES coupons(id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_operator_id_fkey" FOREIGN KEY (operator_id) REFERENCES app_users(id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_plate_verified_by_fkey" FOREIGN KEY (plate_verified_by) REFERENCES app_users(id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_station_fuel_id_fkey" FOREIGN KEY (station_fuel_id) REFERENCES station_fuel_products(id);
ALTER TABLE public."fuel_sessions" ADD CONSTRAINT "fuel_sessions_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_corporate_company_id_fkey" FOREIGN KEY (corporate_company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES app_users(id);
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES app_users(id);
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_corporate_company_id_fkey" FOREIGN KEY (corporate_company_id) REFERENCES corporate_companies(id);
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES app_users(id);
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES app_users(id);
ALTER TABLE public."notification_outbox" ADD CONSTRAINT "notification_outbox_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."overtime_requests" ADD CONSTRAINT "overtime_requests_shift_assignment_id_fkey" FOREIGN KEY (shift_assignment_id) REFERENCES shift_assignments(id);
ALTER TABLE public."payment_method_consents" ADD CONSTRAINT "payment_method_consents_billing_group_id_fkey" FOREIGN KEY (billing_group_id) REFERENCES billing_groups(id);
ALTER TABLE public."payment_method_consents" ADD CONSTRAINT "payment_method_consents_consented_by_fkey" FOREIGN KEY (consented_by) REFERENCES app_users(id);
ALTER TABLE public."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_source_period_id_fkey" FOREIGN KEY (source_period_id) REFERENCES payroll_periods(id);
ALTER TABLE public."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_target_period_id_fkey" FOREIGN KEY (target_period_id) REFERENCES payroll_periods(id);
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_run_id_fkey" FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id);
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES employee_payment_methods(id);
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_payroll_line_id_fkey" FOREIGN KEY (payroll_line_id) REFERENCES payroll_lines(id);
ALTER TABLE public."payroll_payouts" ADD CONSTRAINT "payroll_payouts_station_bank_account_id_fkey" FOREIGN KEY (station_bank_account_id) REFERENCES station_bank_accounts(id);
ALTER TABLE public."payroll_periods" ADD CONSTRAINT "payroll_periods_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."payroll_runs" ADD CONSTRAINT "payroll_runs_payroll_period_id_fkey" FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id);
ALTER TABLE public."pricing_rules" ADD CONSTRAINT "pricing_rules_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES pricing_plans(id);
ALTER TABLE public."saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES saas_invoices(id);
ALTER TABLE public."saas_invoice_lines" ADD CONSTRAINT "saas_invoice_lines_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."saas_invoices" ADD CONSTRAINT "saas_invoices_billing_group_id_fkey" FOREIGN KEY (billing_group_id) REFERENCES billing_groups(id);
ALTER TABLE public."saas_payment_attempts" ADD CONSTRAINT "saas_payment_attempts_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES saas_invoices(id);
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."salary_advances" ADD CONSTRAINT "salary_advances_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."sales_assignments" ADD CONSTRAINT "sales_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES app_users(id);
ALTER TABLE public."sales_assignments" ADD CONSTRAINT "sales_assignments_sales_user_id_fkey" FOREIGN KEY (sales_user_id) REFERENCES app_users(id);
ALTER TABLE public."sales_assignments" ADD CONSTRAINT "sales_assignments_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_replacement_of_fkey" FOREIGN KEY (replacement_of) REFERENCES shift_assignments(id);
ALTER TABLE public."shift_assignments" ADD CONSTRAINT "shift_assignments_shift_template_id_fkey" FOREIGN KEY (shift_template_id) REFERENCES shift_templates(id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES app_users(id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_original_assignment_id_fkey" FOREIGN KEY (original_assignment_id) REFERENCES shift_assignments(id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_replacement_assignment_id_fkey" FOREIGN KEY (replacement_assignment_id) REFERENCES shift_assignments(id);
ALTER TABLE public."shift_change_requests" ADD CONSTRAINT "shift_change_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES app_users(id);
ALTER TABLE public."shift_templates" ADD CONSTRAINT "shift_templates_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."station_bank_accounts" ADD CONSTRAINT "station_bank_accounts_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_brand_product_id_fkey" FOREIGN KEY (brand_product_id) REFERENCES brand_fuel_products(id);
ALTER TABLE public."station_fuel_products" ADD CONSTRAINT "station_fuel_products_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."station_modules" ADD CONSTRAINT "station_modules_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES pricing_plans(id);
ALTER TABLE public."station_subscriptions" ADD CONSTRAINT "station_subscriptions_station_id_fkey" FOREIGN KEY (station_id) REFERENCES stations(id);
ALTER TABLE public."stations" ADD CONSTRAINT "stations_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES fuel_brands(id);
ALTER TABLE public."stations" ADD CONSTRAINT "stations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES app_users(id);
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES app_users(id);
ALTER TABLE public."topup_requests" ADD CONSTRAINT "topup_requests_station_bank_id_fkey" FOREIGN KEY (station_bank_id) REFERENCES station_bank_accounts(id);
ALTER TABLE public."wallet_ledger" ADD CONSTRAINT "wallet_ledger_account_id_fkey" FOREIGN KEY (account_id) REFERENCES corporate_station_accounts(id);

CREATE INDEX idx_attendance_employee_date ON public.attendance_events USING btree (employee_id, occurred_at);
CREATE INDEX idx_audit_events_scope ON public.audit_events USING btree (station_id, created_at);
CREATE UNIQUE INDEX corporate_tax_id_verified_unique ON public.corporate_companies USING btree (regexp_replace(tax_id, '[^0-9]'::text, ''::text, 'g'::text)) WHERE ((tax_id IS NOT NULL) AND (btrim(tax_id) <> ''::text));
CREATE INDEX corporate_link_requests_company_pending ON public.corporate_station_link_requests USING btree (company_id, status);
CREATE INDEX coupon_photo_checks_coupon_decision_idx ON public.coupon_photo_checks USING btree (coupon_id, decision, checked_at DESC);
CREATE UNIQUE INDEX coupons_single_successor ON public.coupons USING btree (replaces_coupon_id) WHERE (replaces_coupon_id IS NOT NULL);
CREATE INDEX idx_coupons_account_status ON public.coupons USING btree (account_id, status, expires_at);
CREATE INDEX idx_reservations_account_status ON public.credit_reservations USING btree (account_id, status);
CREATE UNIQUE INDEX employee_payment_primary ON public.employee_payment_methods USING btree (employee_id) WHERE (is_primary AND (status = 'approved'::text));
CREATE INDEX idx_price_schedule_due ON public.fuel_price_schedules USING btree (effective_at) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX memberships_scope_unique ON public.memberships USING btree (user_id, role_code, scope_type, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(station_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(corporate_company_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_notification_outbox_due ON public.notification_outbox USING btree (next_attempt_at) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX overtime_one_pending_per_shift ON public.overtime_requests USING btree (employee_id, shift_assignment_id, planned) WHERE ((status = 'pending'::text) AND (shift_assignment_id IS NOT NULL));
CREATE INDEX idx_payroll_employee ON public.payroll_lines USING btree (employee_id);
CREATE INDEX idx_saas_invoices_group ON public.saas_invoices USING btree (billing_group_id, created_at);
CREATE INDEX idx_sales_assignment_station ON public.sales_assignments USING btree (station_id, effective_from);
CREATE UNIQUE INDEX shift_assignments_employee_template_day ON public.shift_assignments USING btree (employee_id, shift_template_id, shift_date) WHERE (status <> 'cancelled'::text);
CREATE UNIQUE INDEX stations_bank_primary ON public.station_bank_accounts USING btree (station_id) WHERE (is_primary AND active);
CREATE INDEX idx_topup_station_pending ON public.topup_requests USING btree (account_id, status);
CREATE UNIQUE INDEX topup_approved_unique_bank_ref ON public.topup_requests USING btree (station_bank_id, bank_reference) WHERE ((status = 'approved'::text) AND (bank_reference IS NOT NULL));
CREATE UNIQUE INDEX topup_request_unique_slip ON public.topup_requests USING btree (slip_storage_path) WHERE (slip_storage_path IS NOT NULL);
CREATE INDEX idx_wallet_ledger_account ON public.wallet_ledger USING btree (account_id, created_at);

ALTER TABLE public."accounts_receivable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounts_receivable" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."advance_repayments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."advance_repayments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."app_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."ar_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ar_statements" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."attendance_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."attendance_adjustments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."attendance_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."attendance_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."bank_export_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bank_export_batches" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."billing_group_stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_group_stations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."billing_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."billing_groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."biometric_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."biometric_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."brand_fuel_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."brand_fuel_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commission_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commission_entitlements" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commission_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commission_ledger" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commission_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commission_payouts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."commission_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commission_rules" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_companies" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_drivers" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_price_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_price_rules" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_station_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_station_accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_station_link_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_station_link_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."corporate_vehicles" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."coupon_photo_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coupon_photo_checks" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."coupon_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coupon_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coupons" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."credit_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."credit_reservations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."employee_payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."employee_payment_methods" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."employees" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_brands" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_evidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_price_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_price_schedules" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_price_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_price_versions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fuel_sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."leave_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."notification_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_outbox" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."overtime_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."overtime_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payment_method_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_method_consents" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_adjustments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_payouts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_periods" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payroll_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_plans" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_rules" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."promotions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."request_idempotency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."request_idempotency" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."saas_invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."saas_invoice_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."saas_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."saas_invoices" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."saas_payment_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."saas_payment_attempts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."salary_advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."salary_advances" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."sales_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sales_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."shift_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."shift_change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_change_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."shift_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shift_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."station_bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."station_bank_accounts" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."station_fuel_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."station_fuel_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."station_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."station_modules" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."station_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."station_subscriptions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."stations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."stripe_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stripe_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."topup_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."topup_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."wallet_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."wallet_ledger" FORCE ROW LEVEL SECURITY;
