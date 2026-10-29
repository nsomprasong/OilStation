# OilStation — Integrated User Acceptance Test (single user-facing test round)

**State:** Draft, not executable yet. Do not invite the owner to test until all release gates are met.
**Test domain:** https://oilstation.goldensoft.cloud
**Project:** Supabase `cxihsotcpdnalswfoysx`, Cloudflare Worker `oilstation`.
**User workflow:** Finish development → internal security/CI/end-to-end verification → one integrated user-facing UAT on the domain → log and fix issues by location.

## Current implemented development foundation

- Role-based platform setup; brand catalog and station module choice, owner-level station fuel prices.
- Corporate customer created against a station, first corporate admin invitation; linking an existing corporate entity to a second station needs company admin approval. Each station has its own money account.
- Signed public coupon links, immediate wallet reservation at issue, unique cancellation/replacement, start-time pricing, one-time final settlement; no bank funds are moved by the SaaS backend.
- Manual top-up *database functions* with verified bank-reference requirement, duplicate reference defense, debt-first oldest-AR settlement and a single ledger entry, test transactions rolled back. **API/photo storage and bank verification UI are not completed; feature is NOT customer-accessible.**
- HR employee roster, morning/afternoon/night templates, multi-shift scheduling, substitute shift request with provisional non-absence and separate supervisor approval. **GPS/photo/face recognition and payroll end-to-end remain unfinished.**
- All DB privileged routines are service_role-only; direct browser access to 64 public tables stays denied by default.

## Gate A — Foundations & auth (not passed)

- [ ] Configure Google and Facebook OAuth, provider redirect URLs and Supabase Auth policies.
- [ ] Verify invited-email ownership, including Facebook differing-email flow with re-verification.
- [ ] Configure Cloudflare Worker server secrets; no service-role or signing secrets in client.
- [ ] Configure legitimate transaction-email sender and domain/SPF/DKIM (without modifying existing MX routing). Test invitation delivery.
- [ ] Platform admin invitation lifecycle, owner onboarding, station setup and all delegated permission roles.
- [ ] Prove a different company/other station user cannot read, update, approve or send a restricted invitation.

## Gate B — QR Coupon & payments (not passed)

- [ ] Corporate company with multiple station wallets; station-specific product selection and negotiated pricing.
- [ ] Private upload of license plate, dispenser and receipt evidence with signed short-lived storage URLs.
- [ ] QR scan and state checks, protected OCR/liveness/photo manual exception rules.
- [ ] Concurrent coupon issuance under real network load, row lock safety, cancel-vs-fuel racing, expiration and retry.
- [ ] Top-up slip delivery, pending queue, bank received verification, debt-first and duplicate transfer cases.
- [ ] Real-time dashboard refresh; negotiated/public price scheduled updates during fueling.
- [ ] Generate printable receipt and reconciliation history.

## Gate C — HR/Payroll (not passed)

- [ ] Station geofence rules, live-camera evidence, proper consent/retention for biometrics.
- [ ] Employee shifts, double shift, substitute shift, overnight and break recording; manager retrospective approval.
- [ ] Employee self-service attendance; late/absence/leave and both planned/emergency OT.
- [ ] Payroll frequencies, lawful withholding/tax/social-security/deduction calculation and approvals.
- [ ] Salary advances, weekly/current-or-next-cycle repayments, closed payroll adjusted next period.
- [ ] Bank export formats, multi-payee PromptPay QR with verified payee and manual settlement evidence.

## Gate D — SaaS/Stripe & Sales commission (not passed)

- [ ] Module-specific package pricing/employee-tier/usage/bundle changes effective on renewal.
- [ ] Multi-station owner consolidated or separate billing, Stripe embedded Payment Element.
- [ ] Card full amount, QR 2% discount and promotions priced in platform; safe signed Stripe webhooks.
- [ ] Card recurring charge only if owner explicitly opts in, scoped to entire billing group.
- [ ] Invoice paid reconciliation before Sales commissions; effective date splitting and annual clawbacks.
- [ ] LINE notifications that deep-link back into authenticated Web App.

## Gate E — Release prerequisites (not passed)

- [x] GitHub CI checks unit tests, Vite bundle, Worker syntax and Wrangler dry-run.
- [x] Database CRUD and financial transactions tested with local SQL rollback scenarios.
- [ ] Integration tests with real Supabase Auth and isolated staging secrets.
- [ ] Security review: cross-tenant, service-role, rate limit, storage access, QR replay and expiry, data retention.
- [ ] Privacy/legal review for Thailand HR, biometrics, tax/SSO and payment fees.
- [ ] Restore/backups, runbook and rollout plan.
- [ ] Reviewed PR, authorized merge and explicit release approval.
- [ ] Deploy only after all gates and verify URL returns the real app, not maintenance or errors.

## Single coordinated owner test when all gates pass

Open `oilstation.goldensoft.cloud`, use a platform admin, pump owner, corporate accountant/issuer/driver, attendant, manager, employee and Sales accounts. Run the same complete process across two independent pumps and both modules. Collect an issue log with page, steps, expected/actual behavior and evidence; fix issues one by one and rerun *internal* regression tests. The owner should not need to test each intermediate feature or branch.
