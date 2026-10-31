# OilStation — Master UAT: Platform / Station / Corporate

**Plan ID:** QA-20261031-MASTER-001  
**Status:** DRAFT — ready for the owner's per-module approval, NOT an executed test  
**Environment:** https://oilstation.goldensoft.cloud and the EXISTING Supabase project `cxihsotcpdnalswfoysx`  
**Run interface:** ChatGPT normal chat with a real Playwright browser runner when connected; NOT ChatGPT Work  
**Source of requirements:** `docs/superpowers/specs/2026-10-29-oilstation-saas-design.md`, `docs/release/2026-10-29-integrated-uat-plan.md`, `AGENTS.md`, current role-selected UI and production API implementation  
**Important distinction:** A function described in the specification is **not** proof that the currently deployed application implements it. Every item starts NOT TESTED; unsupported/gated items become GAP or BLOCKED with fix/retest work.

## A. Immutable test-data boundaries

1. **Exactly two QA stations:** `QA-STATION-A` and `QA-STATION-B`; do not create a third QA station. The previously existing production station is outside the QA fixture until separately authorized.
2. **Exactly three test corporate station accounts per QA station:** `QA-A-C01..03` and `QA-B-C01..03`, **six station/customer relationships** total. Prefer six distinct QA corporate companies for isolation; never create more than six company accounts. If testing one company across stations, reuse a company, replacing—not adding to—the six relationships.
3. **Exactly two QA platform sales accounts:** `sales01`, `sales02`. **Each Sales must cover BOTH QA stations**: expected four Sales–Station coverage relationships, not four stations. Two concurrent Sales covering the same station is currently a **design/implementation gap**: the existing `platform_transfer_sales_station` effectively treats the station as having one active salesperson. QA must not falsely pass this; add authorized multi-Sales coverage without accidentally duplicating entitlement or payouts.
4. Provision additional QA accounts **only to cover authorized roles** listed in the role matrix below; never create a third Sales or extra QA station/company. One role can use separate users where independence is necessary (e.g. proposer vs approver), but reuse accounts where safe.
5. Test users are admin-provisioned, password-authenticated Supabase Auth accounts with fictional `qa-<alias>@qa.oilstation.invalid` addresses, `email_confirm=true`, `app_metadata.oilstation_qa_run_id`, and real scoped membership rows. **No real email, OTP, OAuth signup, anonymous role impersonation, forged JWT, service key in browser, or public registration.**
6. QA identities must be limited to the two approved QA station IDs, approved associated organization ID(s) and six approved corporate company IDs, except for the two platform Sales accounts. The separate existing bootstrap Super Admin is retained as the trusted QA operator.
7. All created records and derived transaction IDs are added to `docs/qa/runs/<QA_RUN_ID>.md`. No deletion, reset, or automatic cleanup until the owner **explicitly orders it after ALL testing**. At that time, create and approve an enumerated `RESET-PLAN.md`; fresh start may include pre-existing business data only after independent backup, impact and preservation check.
8. No actual money transfer, payroll payment, outgoing customer emails, SMS, real bank verification, real Stripe charge, or live fuel dispenser action is authorized by this plan. Any financial workflow is test-mode simulation/validation only unless separately approved.

### Fixture matrix

| ID | QA Station A | QA Station B |
|---|---|---|
| Platform Sales 01 | Must cover A | Must cover B |
| Platform Sales 02 | Must cover A | Must cover B |
| Customer 01 | A-C01 | B-C01 |
| Customer 02 | A-C02 | B-C02 |
| Customer 03 | A-C03 | B-C03 |

### Role matrix

| Layer | Test role | Minimum identity approach | Test intention |
|---|---|---|---|
| Platform | platform_superadmin | Preserve real existing Super Admin; no cloned superadmin | All platform functions and QA account administration |
| Platform | platform_sales | Exactly 2: sales01, sales02 | Both cover A+B, own commission, isolated records |
| Platform | platform_support | 1 as necessary | Explicit support permissions and denial of finance |
| Organization | organization_owner / owner, billing_manager | Reuse scoped QA users where supported | Owning two stations, SaaS invoices, renewals |
| Station (both A+B) | station_owner, manager | Per station as needed | Permissions, pricing, invitations, approvals |
| Station (both A+B) | cashier, attendant/pump_staff | Per station as needed | QR scan, verification, fueling lifecycle |
| Station (both A+B) | hr_manager, employee / finance_manager | Per station as needed | HR and distinct financial approvals |
| Corporate (6 QA relationships only) | corporate_admin | Per company as needed | Membership, bank/credit, QR administration |
| Corporate (6 QA relationships only) | coupon_issuer, accountant/finance_manager, driver | Per company or scoped reuse | Coupon issuance, money view, driver rights |

**A role is TESTABLE only if it is implemented by the current product; unsupported presets must be recorded as FAIL/GAP, not silently granted extra rights.** No test identity can be given `platform_superadmin` through the test-account creation API.

## B. Platform — approved-capability checklist (P)

| ID | Category | User/business acceptance target |
|---|---|---|
| P-01 | Login and Home | Google/Facebook ordinary production auth unchanged; QA account login visible only when server QA mode enabled; 5-slot dock and under-header functional submenu |
| P-02 | Tenant model | Create/view organization ownership, two QA stations, correct scoped isolation, correct logos and brand |
| P-03 | Station setup | Select brand; custom brand fallback; select QR and/or HR module; prevent invalid station and duplicates |
| P-04 | Product entitlements | Station-specific QR/HR activation and menu/API enforcement; upgrade module safely |
| P-05 | SaaS plans | Edit flat monthly/annual plans, bundle pricing, employee tiers/per-station overrides where actually implemented |
| P-06 | VAT / promotions | VAT settings, promo rules, start/end dates, effective pricing, deterministic rounding |
| P-07 | SaaS billing | Invoice generation, billing group/individual station, snapshots, renewal, arrears/grace status |
| P-08 | Payments | Stripe **test mode only**, PromptPay discount 2%, card opt-in recurring, signed webhook, idempotency; mark BLOCKED until integration safely operable |
| P-09 | Sales roster | Exactly two platform_sales accounts, visible status, permissions; manage without real email |
| P-10 | Sales coverage | BOTH Sales see BOTH stations at once; do not replace one Sales by the other on assignment |
| P-11 | Transfer/history | Effective dates, reassignment audit, prior entitlement immutable, manager vs co-manager distinction if adopted |
| P-12 | Recurring commission | Formula from paid SaaS fees, multiple months, prorate transitions, idempotency, no double attribution |
| P-13 | Commission reporting | Sales01/02 self-only totals; Super Admin combined; trace invoice line → entitlement → ledger; paid ≠ payable |
| P-14 | Support and audit | Permission-gated support, per-station audit trail, no cross-company data leakage |
| P-15 | QA administration | QA mode disabled by default; two synthetic Sales only; scoped QA account provisioning, disable and login behavior, audit/no public signup |

## C. Station / Organization — approved-capability checklist (S)

| ID | Category | User/business acceptance target |
|---|---|---|
| S-01 | Organization/station switch | Two station contexts and correct scoped screens, no cross-station writes |
| S-02 | Membership & invitation | Owner, manager, cashier, attendant, HR, finance roles; ordinary invitation still requires email proof |
| S-03 | Fuel catalog | Brand-specific catalog, enabled products, station public price, fixed corporate / discount pricing |
| S-04 | QR coupon scan | Scan/upload/manual fallback, signing, expiry, cancellation, replacement and replay prevention |
| S-05 | QR reserve & refund hold | Issue reserves available prepaid+credit, never overdraws, cancel/expire release once |
| S-06 | Plate photo & OCR | Capture in browser, private Storage, verify plate before fueling, reject mismatches; actual OCR provider if ready |
| S-07 | Pump start & finish | Lock relevant fuel price at start, prevent duplicate start, settle actual amount and release remainder once |
| S-08 | Pump supervisor review | Review OCR/photo, mismatch denial, station-scoped reason/audit, no unsafe overrides |
| S-09 | Corporate customer create | Exactly 3 accounts per QA station; create/edit/profile; owner does not see other station's accounts |
| S-10 | Cross-station corporate link | Same company can link another QA station only via company approval; no duplicate companies |
| S-11 | Corporate terms | Credit limit, overdue/due mode, negotiated fuel price, company balances independently per station |
| S-12 | Top-up slip intake | Station bank selection, private slip upload, pending status, anti-duplicate evidence |
| S-13 | Top-up approval | Two-person verification, external real money confirmation not faked, debt-first allocation; automated simulations only |
| S-14 | AR and ledger | Prepaid, credit, debt, reservation, aging, immutable ledger consistency |
| S-15 | HR employees | Employee roster and role association; create/edit, wage inputs and onboarding |
| S-16 | HR shifts | Seed morning/afternoon/night, assign, duplicate/overlap validation, shift coverage |
| S-17 | Substitute shifts | Replacement, retroactive approval, absence not prematurely decided, reviewer role separation |
| S-18 | Attendance & GPS | Punch in/out, geofence, rejected/unverified location, authorized correction |
| S-19 | Attendance reviews/OT | Overtime request, approve/reject/partial minutes, no self-approval, historical ledger |
| S-20 | Payroll | Earnings, deductions, advances, lock/review, payslip, PromptPay/bank export **simulation only** |
| S-21 | Station SaaS choice | Owner selects eligible plan, station vs group billing, subsequent renewal state |
| S-22 | Mobile UX | 5-slot dock, Header submenu, floating add/edit, 360–430px widths, Android back, camera/error recovery |

## D. Corporate customer — approved-capability checklist (C)

| ID | Category | User/business acceptance target |
|---|---|---|
| C-01 | Corporate login | Synthetic QA corporate user logs into real Auth and sees only own company |
| C-02 | Six fixed QA accounts | Each of A/B has exactly C01–C03; no 7th relation created |
| C-03 | Company profile | Corporate admin views/edits allowed info; other company isolation |
| C-04 | Company members | Admin invites issuer, accountant and driver (normal mode invites remain strict) |
| C-05 | Station linking | Existing company requests/approves second QA station when selected as replacement fixture |
| C-06 | Corporate funding | Choose station receiving bank account, submit test slip, see pending (no fake received money) |
| C-07 | Account balance | Prepaid, credit limit, debt, reserved and available-by-station accurate |
| C-08 | QR issuance | Issue signed QR for correct company/station, plate-binding, amount, expiry and fuel limits |
| C-09 | Coupon lifecycle | View active/used/cancelled; cancel/reissue without duplicate reservations |
| C-10 | Driver/issuer access | Issuer can issue; driver limited to authorized work; accountant's finance visibility correctly enforced |
| C-11 | History & receipts | Per station ledger/invoice/fuel receipt visibility without crossing tenants |
| C-12 | Mobile/error UX | First use, empty, validation, reload, cancel, loading state, error recovery, no frozen controls |

## E. Cross-cutting mandatory acceptance

| ID | Required property |
|---|---|
| X-01 | Live Browser E2E real click and submit, desktop and mobile, real screenshots and Playwright trace |
| X-02 | POST/PUT responses plus authoritative Supabase DB state, persistence after logout and fresh session |
| X-03 | Cross-role/tenant authorization checked by API **not only hidden menus** |
| X-04 | Nonexistent IDs, invalid amounts, duplicate requests, race conditions/idempotency |
| X-05 | Correct Thai wording, visible Save/Cancel/Edit, accessible labels, focus, no stacked unused cards |
| X-06 | Performance/no console exceptions/failed network calls; offline/timeout/error recovery |
| X-07 | Audit chronology and financial immutable data; no unauthorized side effects |
| X-08 | CI, merge, deploy to approved production preview, post-deploy browser smoke and health |
| X-09 | No data cleanup automatically; owner orders final deletion only after all modules are finished |
| X-10 | Final approved clean-start plan preserves required platform bootstrap, schema, secrets and history required by policy |

## F. Required real-world gap checks **before** executing live browser tests

- **QA browser runner is not yet connected**. Existing Node tests are not equivalent to a browser that creates records.
- **Production preview** currently permits only selected pilot onboarding routes. `OILSTATION_API_ENABLED=false`: most fuel/corporate/HR/finance routes are intentionally blocked and require separate readiness tests before release. Do not quietly change financial gate behavior to force a PASS.
- **Shared Sales coverage gap:** the current `platform_transfer_sales_station` inserts a sole new salesperson effective next midnight and ends the previous person's period. It does not implement two simultaneous Sales on the same station. Must be redesigned and regression-tested before P-10 can PASS.
- A commission split between concurrent Sales is **not yet agreed**. Require explicit attribution rule at the product level before calculating and displaying a split; never credit the same subscription invoice line twice.
- No real email, real bank or real payroll test is needed to exercise QA auth. Production invite/OAuth workflows remain separate tests, marked BLOCKED when provider test access is unavailable.

## G. Test procedure and go-live policy

1. Freeze this Master scope and create a detailed `docs/qa/plans/<module>.md` for each section. Owner approves plan before test writes.
2. Capture current full baseline, verify backup/restore, and prepare a unique `QA_RUN_ID`.
3. Turn QA account mode on **only** with explicit Cloudflare server flag and locked run ID/scoped allowlists. Never leave unrestricted sign-up available.
4. Seed exactly two QA stations and six station/customer relationships; provision test accounts for the role matrix; exactly two Sales with coverage of both stations.
5. Run Browser E2E/SQL/API, log failures, patch, CI, merge, deploy, repeat until each approved case PASS. A BLOCKED or GAP case never counts as PASS.
6. After **all sections complete** show the owner an inventory. **Do not delete or restart anything** until an explicit separate deletion order; then create an exact `RESET-PLAN.md`, verify recovery, clean approved records, redeploy worker as a serverless reset and recheck first-run login.

**No QA station/customer/test user has been created by writing this document.**
