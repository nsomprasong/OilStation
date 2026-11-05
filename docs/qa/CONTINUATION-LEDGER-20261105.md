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

## Completed sequential single-case evidence — never rerun a PASS without owning code changes

| Case ID | Actor / page | Expected observable result | Status |
|---|---|---|---|
| **OS-QA-ST-CUSTOMER-REPORT-002** | s01b-owner, mobile Customers > Fuel Report, empty history and plate filter | One report pane, GET 0 completed sessions, plate filter and no writes | **PASS — 1/1 browser run 41987875581**; see `docs/qa/runs/OS-QA-ST-CUSTOMER-REPORT-002.md` |
| **OS-QA-ST-CUSTOMER-CREDIT-003** | s01b-owner, mobile Customers > Credit, three existing corporate accounts | All 6 money values per account reconcile to scoped GET; refresh and no writes | **PASS — 1/1 browser run 41988952559**, documented in `docs/qa/runs/OS-QA-ST-CUSTOMER-CREDIT-003.md` |
| **OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004** | s01b-owner, mobile Customers > Create account; invalid required/email/tax/billing-day inputs | Validated form visibility and native/custom input rejection with no writes | **PASS — 1/1 browser run 41994519937** after PR #161 fix; see `docs/qa/runs/OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004.md` |
| **OS-QA-ST-MEMBER-DIRECTORY-005** | s01b-owner, mobile Invitations > Member Directory; single search by email/name/role | Scoped GET; true table count, search, empty state, reset; no member writes | **PASS — 1/1 browser run 41995524307**, evidence in `docs/qa/runs/OS-QA-ST-MEMBER-DIRECTORY-005.md` |
| **OS-QA-ST-INVITE-VALIDATION-006** | s01b-owner, mobile Invitations > Add Member > Email invitation drawer | Six allowed roles, blank/invalid email guards, close; no invitation write | **PASS — 1/1 browser run 41996206907**, details in `docs/qa/runs/OS-QA-ST-INVITE-VALIDATION-006.md` |
| **OS-QA-ST-MEMBER-EDIT-UI-007** | s01b-owner, mobile Invitations > directory > edit member | Review editor, choose temporary role, cancel, reload unchanged; protected owner | **PASS — 1/1 browser run 42006256893**, see `docs/qa/runs/OS-QA-ST-MEMBER-EDIT-UI-007.md` |
| **OS-QA-ST-MEMBER-DEACTIVATE-CANCEL-008** | s01b-owner, mobile Invitations > manager > deactivate confirmation | Warning, cancel, member still active; protected owner; no writes | **PASS — 1/1 browser run 42006986846**, see `docs/qa/runs/OS-QA-ST-MEMBER-DEACTIVATE-CANCEL-008.md` |
| **OS-QA-ST-MEMBER-ROLE-WRITE-009** | s01b-owner, one QA-only attendant role change and restore | UI/API write then mandatory API restore; exact two audit transitions; no HR/finance mutation | **PASS — 1/1 browser run 42012265036** after role validation fix PR #169; see `docs/qa/runs/OS-QA-ST-MEMBER-ROLE-WRITE-009.md` |
| **OS-QA-ST-MEMBER-CROSS-SCOPE-DENIAL-010** | s01a-owner, attempt to edit s01b QA member by API | 403 on foreign member POST and directory GET; no audit | **PASS — 1/1 browser run 42013264806**, see `docs/qa/runs/OS-QA-ST-MEMBER-CROSS-SCOPE-DENIAL-010.md` |
| **OS-QA-ST-MEMBER-ROLE-ESCALATION-DENIAL-011** | s01b-owner tries unauthorized platform role | 400 denied, existing QA attendant unchanged | **PASS 1/1 run 42016796199**; `docs/qa/runs/OS-QA-ST-MEMBER-ROLE-ESCALATION-DENIAL-011.md` |
| **OS-QA-ST-PROTECTED-OWNER-CHANGE-DENIAL-012** | s01b-owner protected membership | API 403 owner role protected | **PASS 1/1 run 42017569238**; `docs/qa/runs/OS-QA-ST-PROTECTED-OWNER-CHANGE-DENIAL-012.md` |
| **OS-QA-ST-FUEL-PRICE-INVALID-013** | s01b fuel pricing invalid inputs | reject zero, negative, too-many-decimals; original unchanged | **PASS 1/1 run 42018383018**; `docs/qa/runs/OS-QA-ST-FUEL-PRICE-INVALID-013.md` |
| **OS-QA-ST-FUEL-CROSS-SCOPE-DENIAL-014** | station s01b owner foreign fuel pricing | foreign read/write denied 403, no changes | **PASS 1/1 run 42019137721**; `docs/qa/runs/OS-QA-ST-FUEL-CROSS-SCOPE-DENIAL-014.md` |
| **OS-QA-ST-PUMP-EMPTY-QR-AND-PHOTO-FIELDS-015** | s01b cashier pump empty QR and photo evidence | required QR and JPEG/PNG photo inputs, no OCR/no write | **PASS 1/1 run 42020044531**; `docs/qa/runs/OS-QA-ST-PUMP-EMPTY-QR-AND-PHOTO-FIELDS-015.md` |
| **OS-QA-ST-PLAN-QUOTE-READONLY-016** | s01b owner SaaS quote | cards and discounted PromptPay quote, no persistence | **PASS 1/1 run 42021367093**; `docs/qa/runs/OS-QA-ST-PLAN-QUOTE-READONLY-016.md` |
| **OS-QA-ST-PLAN-SELECTION-INVALID-017** | s01b owner malformed SaaS selection | five negative 400/403 and saved selection unchanged; first test transport fail repaired | **PASS 1/1 run 42025889632**; `docs/qa/runs/OS-QA-ST-PLAN-SELECTION-INVALID-017.md` |
| **OS-QA-ST-PLAN-CROSS-SCOPE-READ-018** | s01a owner attempts s01b billing GET | own 200, foreign 403, unauthenticated 401; no write | **PASS 1/1 run 42026668944**; `docs/qa/runs/OS-QA-ST-PLAN-CROSS-SCOPE-READ-018.md` |
| **OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019** | s01b cashier, same-station owner-only billing | admin Plan hidden, direct billing GET 403, no write | **PASS 1/1 run 42027584480**; `docs/qa/runs/OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019.md` |

## Case queue — not yet executed, do not mass-run

| Priority | Future test target | Gate |
|---|---|---|
| COMPLETE | Station s01b Customers report case **002** | PASS 1/1 read-only scoped Browser + SQL, do not repeat |
| COMPLETE | Station s01b Customers credit case **003** | PASS 1/1, 3 cards × 6 values and refresh |
| COMPLETE | Station s01b Customers account creation **validation** case **004** | PASS 1/1, genuine invalid-input browser and no write; not a positive create |
| COMPLETE | Station s01b Invitations member directory read/search case **005** | PASS 1/1, scoped seven-member GET + search/empty/reset, no write |
| COMPLETE | Station s01b Invitation drawer invalid input **006** | PASS 1/1, protected 6 roles, invalid email and cancellation, no writes |
| COMPLETE | Station s01b member role editor UI review/cancel **007** | PASS 1/1, role draft cancelled and server role unchanged, no writes |
| COMPLETE | Station s01b member deactivation dialog review/cancel **008** | PASS 1/1, warning/cancel/active role preserved and no writes |
| COMPLETE | Station s01b member role change + rollback **009** | PASS 1/1, fixed role allowlist, exact two audit events, role and data restored |
| COMPLETE | Station s01a owner cross-scope member modification deny **010** | PASS 1/1; foreign read + write both 403; no audit delta |
| COMPLETE | Station member privilege, fuel price and pump guard cases **011–015** | Confirmed each protected Chromium 1/1, only declared scope; reports in `docs/qa/runs/` |
| COMPLETE | SaaS plan quotes and selection negative/scope/role cases **016–019** | Confirmed protected Chromium 1/1 each; no billing transaction written |
| P1 — NEXT SAFE PREFLIGHT | **020** — positive SaaS plan-selection intent/rollback | **NOT TESTED / BLOCKED until isolated synthetic checkout fixture and verified recover-to-original**; do not write baseline station checkout |
| P1 | Station Customer new account, existing link, credit, fuel prices, pump, Plan, Invitations; each **separate** read/validation/write case | Each case needs exact QA manifest; do not mutate existing customer data without verified recovery |
| P1 | Station HR People, Attendance, Review, OT, substitution, Leave, Payroll; **individual bounded QA-HR** cases | Live HR explicitly denies QA actors; use separately scoped approved QA lane; never weaken normal auth |
| P1 | Corporate topup, QR issuance/reservation, plate/photo verification, completed fueling and reporting | Protected QA-only transaction flow with rollback/compensation and audit; no real bank/fuel operations |
| P2 | Platform create station, Sales transfer, paid commission, SaaS billing, VAT/Stripe | Appropriate roles, test-only IDs, safety gates and cleanup proof |
| P2 | All 236 master UAT cases + responsive/regression/security, fail/retry/idempotency and recovery | No full go-live PASS until actually executed and closed individually |

## Current checkpoint

As of 2026-11-05, **002–019 PASS** only within each explicitly recorded test scope. **001 HR API remains BLOCKED 403**; positive business writes (including fueling, topping up, payroll, checkout/Stripe) and the original 236 UAT catalogue remain incomplete. The next case must first prove a reversible synthetic fixture or be marked BLOCKED. Live Supabase read-only counts after 019: memberships 100, audit_events 260, payroll_runs 0.

## Release criteria (not satisfied as of this ledger update)

- Every required transactional case **passed end-to-end with evidence** (UI+API+DB), not merely menu-open/GET checks.
- QA identity/secret cleanup plan and secure rollback/backup verified; no baseline protected record destroyed.
- Scoped finance/HR/billing invariants, payroll approvals, multi-tenant RLS, Stripe/webhook safety, recovery and audit passed.
- Controlled production release approved through existing gated `controlled-deploy.yml` and `oilstation_release_status()`, followed by live smoke and payment safeguards. Do not equate **Production Preview Deploy** (full business API off) with **full production release**.
- Never re-run the already passed read-only 98-account, Platform and Corporate sweeps just to advance this ledger. A targeted regression may be justified if its code changes.
