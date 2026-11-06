# OilStation — Master TEST-6-007: Sales attribution empty-state + Thai mobile accessibility

**2026-11-06.** New ONLY 075–080 specs, one protected serial six-case Chromium batch after exact-SHA guarded Preview; no production finance / payroll gate change. Historical 001–006 completed at scoped assertions; Master full UAT not auto-cleared.

| QA case | Master | Actor | Acceptance |
|---|---|---|---|
| 075 | P-12-R | sales01 | Commission/paid customer reporting uses server-scoped Sales ID and only 2 own station assignments; Sales02 station identifiers absent |
| 076 | P-13-V | sales01 | Zero entitlement/paid-customer arrays generate truthful empty state, never display paid commission as earned |
| 077 | P-13-F | sales02 | Real desktop/mobile Sales commission Refresh sends authorized GET; response/visible state match actual unchanged entitlements and assignments |
| 078 | X-05-H | s01b-owner | Thai plate-history label, keyboard Enter applies filter, live API returns zero rows with explicit accessible empty state |
| 079 | X-05-V | s01b-owner | Home 320/360/390-pixel mobile widths must not have global horizontal overflow; empty report filter must be navigable |
| 080 | X-06-H | s01b-owner | Multi-page operational read-only journey: Customers Credit, completed Fuel Report, owner Plan options all finish loading without uncaught JS errors |

## Frozen DB fixture and evidence

- Read-only SQL preflight: `commission_entitlements=0`, `commission_ledger=0`, `commission_payouts=0`, `saas_invoices=1`, `sales_assignments=4`, `audit_events=260`, `payroll_runs=0`. These same counts must be verified after Chromium.
- Production SQL `platform_sales_workspace` filters people/assignments/commissions/collectedCustomers to the requesting Sales user unless the actor is a platform admin; no paid commission lines exist in the synthetic fixture. This test does not invent paid earnings.
- No active transfer request, user creation, company creation, bill/charge/Payroll operation or money write. All QA roles sign in under exact pre-existing scoped memberships; no QR or finance enablement.
- Scope caveat: Master P-12-R has no paid commission in this fixture; verified self-scope applies to read-side data, *not a real paid entitlement across two Sales*. Keep full financial Commission UAT pending rather than claiming full-payment PASS.
- Master X-05-H/V are bounded Thai keyboard and responsive checks. Broader multi-device assistive technology acceptance remains separate.

**Before run:** NOT RUN; require 12/12 PR CI, matching Preview, 6/6 Chromium and independently identical DB counts.
