# OilStation production HR-only operational release — 2026-11-04

QA ID: `QA-20261104-HR-OPERATIONS-LIVE-004`.

## Owner's goal and actual baseline

Owner asks to continue until the current OilStation deployment is usable for real station operations, using existing production Supabase `cxihsotcpdnalswfoysx`. The owner explicitly opted out of a backup in the previous conversation. This change does not delete or reset business rows.

Preflight verified: `main` `802f1295d24432476c715257fcd8522a41a490c5`, Cloudflare Worker has `OILSTATION_API_ENABLED=false`, `OILSTATION_PREVIEW_OPERATIONS_ENABLED=true`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`. Production SQL draft guard is installed and verified. 3/3 employees are synthetic QA, 0 real employees, 2 pending attendance punches, 8 approved-undisbursed salary advances, 0 wage policies, 0 payroll periods/runs/lines/payouts.

**Financial release is not approved.** Current verified tax, social-security, wage/leave, bank/payment instructions are absent. Do NOT unlock `OILSTATION_API_ENABLED`, Stripe, scheduled customer finance, bank export or payroll payout.

## Goal of this change

Allow authenticated **non-QA** station staff to use narrowly defined day-to-day HR services while full finance stays closed, through a second independently controlled production toggle `OILSTATION_HR_OPERATIONS_ENABLED`.

- Station-owner/manager/HR-manager may manage station employee, shift, leave, OT, GPS attendance review with original server-side RPC authorization. Station-local role and stationId enforced twice (Worker and RPC).
- A station's active employee/member may request own leave, OT or GPS punch subject to existing DB RPC authorization; approval remains manager/supervisor only via existing SQL. All salary/leave effects remain *undetermined pending policy approval*.
- **Read-only** HR Payroll: readiness, policies, drafts list, reviewed attendance preview. **No** payroll policy proposal/approval, draft line/review writes, advances/payee changes, transfer/payment/export, or any coupon/fuel/billing finance route in this gate.
- Only explicit allowlisted routes and HTTP methods. No arbitrary `/api/hr/*` proxy. Reject QA account in production lane; QA-only path requires separate short-lived gate.
- Do not enable module for a station that does not have the HR subscription entitlement; rely on existing trusted station RPC where available and check at API gateway for station scope. No extra public table grants.
- Preserve existing `/api/me`, OAuth, preview Sales/station onboarding; no CSS or user-facing theme changes.

## Tests and release gates

1. Unit/API tests for no-token, bad origin, wrong method, forged scope, cross-tenant, QA identity, missing role, real authorized manager, and employee self-request; verify no DB method reached on denial.
2. Worker integration test for default OFF and strictly scoped ON; prove `/api/hr/payroll/drafts/line`, `/api/hr/payroll/policies/propose`, `/api/hr/advances/*` and `/api/coupons` still return 503.
3. GitHub CI Node/API/isolated SQL checks (13/13) and public Chromium (7 cases) pass on final code.
4. Merge only after CI; production Worker deployment must retain `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`, avoid enabling QA HR UAT, and protect authenticated operations with original DB permissions. No live payroll/bank mutations.
5. If HR-only operational activation lacks real non-QA user/browser coverage, label browser-authenticated UAT BLOCKED; do not claim full station or salary go-live. A real station admin still needs to onboard real staff and review actual labor/statutory terms.

## Pre/post SQL and cleanup

Read-only counters for employees, attendance, advances, payroll/finance tables and audit events. This change adds only Worker routing and tests; no production SQL DDL/DML, no new QA records, no cleanup required. A source-level rollback is reverting the new toggle to false and deploying previous guarded Worker; it does not change Supabase records.

## Evidence

Record PR, SHA, each workflow, Cloudflare version ID, actual HTTP unauthorized probes, SQL row counters and unresolved go-live blockers under `docs/qa/runs/QA-20261104-HR-OPERATIONS-LIVE-004.md`.
