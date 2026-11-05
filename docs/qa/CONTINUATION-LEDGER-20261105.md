# OilStation — Evidence-based QA continuation ledger (2026-11-05)

**Owner direction:** continue unfinished UAT without running previously verified cases again. Execute **one role × one station/company × one screen/task × one bounded operation** per run. Review and mark the result before beginning the next case. This ledger is not permission to mark unexercised writes as PASS.

## Recorded completed checks — do not repeat unless the owning implementation changes

| Evidence ID | Scope actually executed | Result | Durable evidence |
|---|---|---|---|
| QA-20261105-ROTATE-98 | Supabase Auth admin reset and successful sign-in + scoped /api/me for 98 QA accounts | AUTH PASS 98/98 | [GitHub run 41970911176](https://github.com/nsomprasong/OilStation/actions/runs/41970911176) |
| QA-20261105-ROLE-66 | Authorized read-only 66-role browser suite | PASS for its declared read-only checks; not business writes | [GitHub run 41973619795](https://github.com/nsomprasong/OilStation/actions/runs/41973619795) |
| QA-20261105-ROLE-32 | Additional 32-role scoped-browser suite | PASS for its declared read-only checks; not business writes | [GitHub run 41973619739](https://github.com/nsomprasong/OilStation/actions/runs/41973619739) |
| QA-20261105-PLATFORM-SCREEN | Two Sales, four Platform destinations each, 8 UI task observations | PASS 8/8 (read-only) | [GitHub run 41973619900](https://github.com/nsomprasong/OilStation/actions/runs/41973619900) |
| QA-20261105-CORPORATE-SCREEN | Twelve corporate admins and representative driver/issuer; 32 screen observations | PASS 32/32 (read-only) | [GitHub run 41973619900](https://github.com/nsomprasong/OilStation/actions/runs/41973619900) |
| OS-QA-ST-HR-PEOPLE-001 | One station s01a owner, mobile Home > HR > People; /api/me, pane, roster protection | UI PASS; AUTH PASS; backend roster **BLOCKED (403 qa_identity_not_live)** | [GitHub run 41983065736](https://github.com/nsomprasong/OilStation/actions/runs/41983065736) |

**Caution:** Broad Station run `41973619900` hit the browser runtime cap partway through s01a, so the remaining Station pages and all Station write paths are **NOT TESTED**, not FAIL by inference. Original master UAT catalogue contains 236 cases; it is not complete.

## In progress: next unclosed case, only one actor and page

| Case ID | Actor / page | Expected observable result | Status |
|---|---|---|---|
| **OS-QA-ST-CUSTOMER-REPORT-002** | s01b-owner, mobile Customers > Fuel Report, empty history and plate filter | One report pane, GET 0 completed sessions, plate filter and no writes | **PASS — 1/1 browser run 41987875581**; see `docs/qa/runs/OS-QA-ST-CUSTOMER-REPORT-002.md` |
| **OS-QA-ST-CUSTOMER-CREDIT-003** | s01b-owner, mobile Customers > Credit, three existing corporate accounts | Cards/amount breakdown/refresh reconcile against real scoped GET, no writes | **NOT TESTED — next case** |

## Case queue — not yet executed, do not mass-run

| Priority | Future test target | Gate |
|---|---|---|
| COMPLETE | Station s01b Customers report case **002** | PASS 1/1 read-only scoped Browser + SQL, do not repeat |
| P1 | Station s01b Customers credit case **003** | One actor, one task, read-only balance/refresh reconciliation |
| P1 | Station Customer new account, existing link, credit, fuel prices, pump, Plan, Invitations; each **separate** read/validation/write case | Each case needs exact QA manifest; do not mutate existing customer data without verified recovery |
| P1 | Station HR People, Attendance, Review, OT, substitution, Leave, Payroll; **individual bounded QA-HR** cases | Live HR explicitly denies QA actors; use separately scoped approved QA lane; never weaken normal auth |
| P1 | Corporate topup, QR issuance/reservation, plate/photo verification, completed fueling and reporting | Protected QA-only transaction flow with rollback/compensation and audit; no real bank/fuel operations |
| P2 | Platform create station, Sales transfer, paid commission, SaaS billing, VAT/Stripe | Appropriate roles, test-only IDs, safety gates and cleanup proof |
| P2 | All 236 master UAT cases + responsive/regression/security, fail/retry/idempotency and recovery | No full go-live PASS until actually executed and closed individually |

## Release criteria (not satisfied as of this ledger update)

- Every required transactional case **passed end-to-end with evidence** (UI+API+DB), not merely menu-open/GET checks.
- QA identity/secret cleanup plan and secure rollback/backup verified; no baseline protected record destroyed.
- Scoped finance/HR/billing invariants, payroll approvals, multi-tenant RLS, Stripe/webhook safety, recovery and audit passed.
- Controlled production release approved through existing gated `controlled-deploy.yml` and `oilstation_release_status()`, followed by live smoke and payment safeguards. Do not equate **Production Preview Deploy** (full business API off) with **full production release**.
- Never re-run the already passed read-only 98-account, Platform and Corporate sweeps just to advance this ledger. A targeted regression may be justified if its code changes.
