# OilStation — Implementation Plan (Superpowers / Writing Plans)

**Date:** 2026-10-29
**Status:** Ready for iterative implementation on feature branches; not approved for merge or production deploy.
**Source design:** [2026-10-29-oilstation-saas-design.md](../specs/2026-10-29-oilstation-saas-design.md)
**Repository:** `nsomprasong/OilStation` | **Database:** Supabase project `cxihsotcpdnalswfoysx` | **Worker:** `oilstation` | **Hostname:** `oilstation.goldensoft.cloud`

## Ground truth and constraints

- Production Supabase currently has **63 public tables**, **63 RLS enabled + forced**, no authenticated/anon table privileges or policies. It is intentionally inaccessible to browsers.
- Existing 19 legacy tables were preserved in a private `legacy_archive_20261029` schema. Do not remove or expose without separate consent.
- Live Supabase migrations: `20261029113107_rebuild_oilstation_saas_schema_20261029` and `20261029113226_seed_oilstation_fuel_catalog_20261029`. These were previously applied through Supabase. Import/verify exact DDL into version-controlled migration files before new production migrations. **Never recreate these migration versions blindly.**
- Master fuel catalog: 14 brands / 62 entries (57 products and 5 custom placeholders), none enabled for sales. Station must explicitly select and price products.
- Existing Cloudflare Worker serves only a temporary holding page. Do not overwrite or deploy an app without a separate go-ahead.
- No GitHub main merge or live Cloudflare deploy without explicit approval; work in a branch and open a draft PR.
- Source-of-truth local for development; verify branch/HEAD/diff before each edit and do not restore from Git automatically.
- Keep all funds in integer satang and fuel prices in fixed decimal precision; avoid floating-point for authoritative balances.
- Need Thailand PDPA / labor / tax reviews before going live; no production Payroll or biometric collection before compliance sign-off.

## Technical direction

1. **Cloudflare Worker TypeScript** provides API and scheduled processing; Cloudflare deployment via Wrangler with explicit environments and Secrets. Build static UI in React + Vite (minimal, mobile-first), hosted as Worker static assets after review. Production Worker remains untouched.
2. **Supabase PostgreSQL** is authoritative for authorization scopes and all money/QR transactions. Supabase Auth with invite-only Google/Facebook OAuth. No public sign-up path. Privileged operations use server-only credentials; never put service-role keys in the browser.
3. **Multi-tenant:** platform → owner organization → station → subscribed module; corporate company joins specific station via corporate_station_accounts. Unique station scope on every money operation; never rely on client-supplied station_id without server membership check.
4. **Domain layer:** pure deterministic functions for prices, balances and commission proration, with PostgreSQL transactions enforcing final balance/reservation writes. Pure calculation code is *not* a substitute for DB locking.
5. **Background processes:** price schedules, coupon expiry, invoice renewal/dunning, Payroll close and commissions; retries idempotent, with audit logs.

## Execution order and TDD checkpoints

### Phase 0 — Source, build and migration baseline
- [ ] Record live `public` schema, indexes, constraints, RLS and grants in a reviewed baseline file without secrets. Verify against existing Supabase migration history; do not reapply baseline.
- [ ] Set up a reproducible repository (Node pinned via `.nvmrc`, lockfile, lint, typecheck, tests, Worker dev/test environments). No automatic production deploy from feature branches.
- [ ] Add health endpoint `/api/health` without reading secrets or production data, plus request IDs and error envelope. Test success, method not allowed, and no leakage of env secrets.
- [ ] Smoke-test app locally / preview only; don't claim a PASS without showing run output.

### Phase 1 — Auth, invitations and tenant isolation
- [ ] Write failing tests: unknown user gets 401; member of Station A cannot read B; corporate user cannot read nonjoined station; Sales cannot view unassigned station; revoked invitation cannot be replayed; revoked membership has no access.
- [ ] Build invite-only login, OAuth account binding and verified invited email ownership (including Facebook email differences). No self-service registration.
- [ ] Model permission presets plus delegated grants. Station/corporate scope enforced in Worker and database; tests for privilege escalation and cross-org IDOR.
- [ ] Add least-privilege RLS policies/grants after functional verification; leave financial/biometric data server-only. For direct client access, add narrowly scoped per-table policies and run `anon`, `authenticated`, and cross-tenant negative tests.
- [ ] Database advisory review; block merge on Critical findings.

### Phase 2 — Brand-aware setup, prices and coupon funds
- [x] Live catalog seeded; 14 brands / 62 entries.
- [ ] Test brand filtering, disabled default, required positive public price, company negotiated fixed/discount price and scheduled price locked at **start-fueling**.
- [ ] Write failing concurrency tests for **reserve at coupon issuance**, simultaneous issuances, insufficient available funds, duplicate requests, cancel/expire race, and double redemption. Available amount = prepaid + unused authorized credit - outstanding debt - *all active holds*.
- [ ] Implement issuance as a single PostgreSQL transaction: resolve and authorize (station/account/issuer, module, fuel), `SELECT ... FOR UPDATE` wallet account, validate available amount, create one-time coupon + hold, increment reserved and append ledger, commit. If insufficient, commit nothing usable.
- [ ] Build cancel/expire/replace as atomic transitions; do not release in-progress fueling holds. On settlement consume actual net amount once and release unused reserve in same transaction. Append-only ledger, unique idempotency keys, audit.
- [ ] Create immutable price snapshots at start; unit-test end time across a scheduled price change. Verify database constraints and overspend under parallel transactions.
- [ ] Implement stable shared URL that rotates private QR credential upon reissue and never exposes corporate balance.

### Phase 3 — Pump transaction and credit operations
- [ ] Scan/verify QR, capture plate, enforce optional plate matching with OCR/manual review *only if actual plate matches*. Evidence kept in protected storage.
- [ ] Photo pump display/OCR/manual liters and receipt; validate gross vs net, fuel limit, station/product scope, proper date/time.
- [ ] Top-ups require manual payment receipt confirmation at pump; slip dedup, debt-oldest-first settlement, AR aging and statements; no Stripe transfer of pump deposits.
- [ ] Price schedule job, SLAs and reconciliation alerts.

### Phase 4 — HR + Payroll
- [ ] Shifts (morning/afternoon/night), replacement, double shifts (one punch or split), breaks (scheduled or actual), attendance & geofence approval.
- [ ] Opt-in/appropriate legal basis for biometric processing; encrypted templates, liveness and manual fallback, data retention policy before deployment.
- [ ] OT pre-approved/retroactive approvals; payroll weekly/semimonthly/monthly; tax, social security, advances and permitted deductions; closed-period corrections adjusted next period only.
- [ ] Bank-format adapters per bank and manual/PromptPay payee payouts, explicitly reconciled; never mark paid on QR display or file export alone.

### Phase 5 — SaaS subscriptions + Sales
- [ ] Price engine flat/per-employee/tier/bundle, promo snapshots; new published prices take effect for existing customers at next renewal, not retroactively.
- [ ] Group billing multiple stations; card pays list price, QR is 2% discount; pricing locally, Stripe PaymentIntents without manually adding Stripe Products.
- [ ] Stripe Payment Element embedded; group-level opt-in auto-charge unchecked by default; signed idempotent webhook; PromptPay renewals require user action.
- [ ] Commissions only on successfully collected subscription revenue; current assigned Sales gets effective-period share; midperiod transfer, annual payout adjustments, and recovery from future commission payouts, not automatic salary deduction.

### Phase 6 — Quality gate and controlled release
- [ ] Automated auth/RLS/finance concurrency tests and isolated integration DB verification.
- [ ] Mobile-first minimal UI, keyboard/a11y/empty/error states.
- [ ] Threat review (invite links, public QR, service credentials, OCR biometrics, Stripe), backups/restore, observability, audit and monitoring.
- [ ] Draft PR review, approved merge, then **separate explicit approval** for deployment to `oilstation.goldensoft.cloud`.

## First TDD increment: money availability contract

**RED:** tests require exact integer satang arithmetic; no negative inputs, reject overspend, respect existing reserved amounts and unsettled debt, and explicitly allow all-zero balances and zero available.  
**GREEN:** pure domain helper computes available amount and requested reserve while preserving invariants.  
**REFACTOR:** no floating-point, no mutation of balance objects, stable typed boundary when TypeScript app is introduced.

> This helper only previews or validates balances. **Real issuance must be a database-locked transaction**, and user input must never choose a balance to trust.

## Delivery checklist for each phase

1. Check branch and current diff.
2. Write failing tests/acceptance examples first, then smallest implementation.
3. Execute tests, typecheck/lint/build relevant to phase; record actual outputs and failures.
4. Run security review and cross-tenant testing before anything becomes public.
5. Push feature branch and request review; **do not merge or deploy without user approval**.
