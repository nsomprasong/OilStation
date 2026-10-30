-- Minimal composite FK-leading indexes for high-traffic OilStation paths.
-- Based on read-only Supabase performance advisor + table catalog (Oct 2026).
-- Not retroactively applied; benchmark on staging before production rollout.
-- Maintainers should review locking/maintenance window for large live tables.
CREATE INDEX IF NOT EXISTS oilstation_ar_account_due_idx
 ON public.accounts_receivable(account_id,due_at,id)
 WHERE outstanding_satang>0;
CREATE INDEX IF NOT EXISTS oilstation_ar_fuel_session_idx
 ON public.accounts_receivable(fuel_session_id)
 WHERE fuel_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_wallet_company_station_idx
 ON public.corporate_station_accounts(company_id,station_id);
CREATE INDEX IF NOT EXISTS oilstation_coupon_account_status_idx
 ON public.coupons(account_id,station_id,status,expires_at);
CREATE INDEX IF NOT EXISTS oilstation_coupon_fuel_station_idx
 ON public.coupons(station_fuel_id,station_id)
 WHERE station_fuel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_fuel_evidence_session_kind_idx
 ON public.fuel_evidence(session_id,kind,created_at DESC);
CREATE INDEX IF NOT EXISTS oilstation_fuel_sessions_station_created_idx
 ON public.fuel_sessions(station_id,created_at DESC);
CREATE INDEX IF NOT EXISTS oilstation_topup_account_review_idx
 ON public.topup_requests(account_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS oilstation_billing_attempt_invoice_created_idx
 ON public.saas_payment_attempts(invoice_id,created_at DESC);
CREATE INDEX IF NOT EXISTS oilstation_memberships_station_active_idx
 ON public.memberships(station_id,active,user_id)
 WHERE station_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_memberships_company_active_idx
 ON public.memberships(corporate_company_id,active,user_id)
 WHERE corporate_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_attendance_shift_idx
 ON public.attendance_events(shift_assignment_id,recorded_at DESC)
 WHERE shift_assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS oilstation_shift_template_date_idx
 ON public.shift_assignments(shift_template_id,shift_date)
 WHERE shift_template_id IS NOT NULL;
