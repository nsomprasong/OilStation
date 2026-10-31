# OilStation — Comprehensive Pre-UAT Situation Simulation Catalog

**Plan:** QA-20261031-MASTER-001 · **Run:** QA-20261031-PLATFORM-001 · **As of:** 2026-10-31
**Status:** SCENARIOS FROZEN / UNIT SIMULATIONS STARTED / AUTHENTICATED BROWSER UAT NOT STARTED
**Machine-readable source of truth:** `docs/qa/scenarios/oilstation-master-scenarios.json` (**236 cases**)
**Applies to:** Existing Supabase `cxihsotcpdnalswfoysx`; OilStation Cloudflare Production Preview (NO staging project).
**Important:** This catalog designs expected behavior; it **does not assert 236 executions have passed**.

## Locked UAT fixture and boundary

- Exactly **2 Sales identities**: `sales01` and `sales02`. Each logs in and creates precisely **2 distinct stations**. Four test stations in all, never a fifth.
- Each of four stations has **3 test corporate companies**, so exactly **12 corporate companies/relationships** (distinct) at most.
- **99 new QA identities**, one identity for every role at every actual organization/station/company node, plus the existing protected Super Admin. Refer to `2026-10-31-oilstation-role-identity-matrix.md`.
- Sales01's and Sales02's station and entitlement data are isolated. Subsequent transfer stays within the same four stations.
- Real bank movement, live Stripe payments, money transfers, real dispenser operation, outgoing email/SMS, and automatic data deletion are out of scope; use pure simulations or safe test provider.
- Preserve baseline originals. Never delete until the owner explicitly orders complete reset after all three parts and approves a separate record-ID manifest with verified recovery.

## How each test is judged

Every ID has four independently scored variants: `-H` normal business flow, `-V` invalid/boundary flow, `-R` forbidden role or tenant crossing, `-F` retry/failure-recovery and idempotency. That's **59 business-control areas × 4 scenarios = 236 cases**. They must be executed through the actual role-authenticated browser where applicable; any API/DB mismatch is FAIL. Financial side-effects require simulated or signed test-mode evidence. An executed **pure Node simulation** receives **SIMULATION PASS/FAIL in a separate report**, not Browser PASS.

### Scenario catalog — Platform (60 planned cases)

| Module | Authorized actor | H: expected business state | V: validation/boundary | R: denied access | F: outage/replay |
|---|---|---|---|---|---|
| P-01 | Super Admin/Sales/support | OAuth login and appropriate Home/dock show | Invalid QA password / expired token denies login | Unauthenticated path and direct admin deep-link denied | Reload/login recovery; QA-only login toggle |
| P-02 | Sales01, Sales02 | Each creates own two unique stations | A third station from QA Sales is rejected atomically | Sales01 cannot inspect/create on Sales02 scope | Retry network failure does not add fifth station |
| P-03 | Sales01 | Active brand + QR or HR initializes staged fuel | Inactive brand, invalid names, zero modules rejected | Cannot submit other salesUserId/ownerId | Reopen form: staged fuel disabled and unpriced |
| P-04 | Station owner | QR/HR feature enabled only for purchased/allowed station | Disabled service cannot launch operational workflow | Station A cannot enable Station B modules | Module switch retains valid previous state and audit |
| P-05 | Platform admin | Monthly/yearly/bundle priced with revisions | Missing price/negative/invalid dates rejected | Sales cannot edit platform prices | Versioned effective-dated plan preserves old invoices |
| P-06 | Platform admin | Tax inclusive/exclusive, 2% QR discount in quote | Rounded satang edges, expired promo and over-discount | Customer cannot override VAT/promo server-side | Price revision uses reviewed policy and quote snapshot |
| P-07 | Billing manager/admin | Invoice draft→issue→paid or renewal from valid period | Duplicate issue/event and invalid period rejected | Other organization's invoice is invisible | Partial outage retries preserve invoice identity and ledger |
| P-08 | Platform billing admin | Signed test payment settlement to one invoice | Amount mismatch/livemode true/unsigned event rejected | No live payment key or charge available in QA | Webhook replay cannot duplicate payment or commission |
| P-09 | Platform admin | Sales01 and Sales02 appear correctly | Sales03 alias blocked by QA account system | Sales cannot create a platform superadmin | Deactivate/reactivate requires access revocation audit |
| P-10 | Sales01/Sales02 | 2 stations per Sales with initial commission assignment | Duplicate request ID returns same station; third station denied | Creator cannot request other Sales ID or own station role | Network timeout resubmission reuses idempotency key |
| P-11 | Platform admin | Midnight-effective transfer from current Sales to other Sales | Second future transfer rejected; history not overwritten | Only Super Admin changes assignment | Already-paid entitlements remain attributed historically |
| P-12 | Platform admin/Sales | Paid invoice allocates correct prorated attribution | Unpaid invoice creates no earned commission; gaps rejected | One Sales cannot see other Sales commission | Reconciliation/reversal adjusts future ledger, no double credit |
| P-13 | Sales01/Sales02 | Self only totals; admin sees aggregate and exact invoice trace | Zero-entitlement empty state shows 0 not paid | Access to another salesperson ID denied | Refresh report shows only confirmed entitlement/ledger |
| P-14 | Support/admin | Support receives limited workspace and audit filters | Unknown events/invalid IDs handled safely | Support cannot create finance approvals/users | Audit chronology stays immutable and query paginated |
| P-15 | Platform Super Admin | Admin provisions only approved 99 scoped role identities | Invalid alias/weak password/cross-scope denied | Ordinary Sales cannot create QA users or disable controls | QA off denies all QA tokens while preserving records |

### Scenario catalog — Station / organization (88 planned cases)

| Module | Authorized actor | H: expected business state | V: validation/boundary | R: denied access | F: outage/replay |
|---|---|---|---|---|---|
| S-01 | Station owner/manager | Four stations switch with correct identity and data | Invalid/missing station ID rejected | Station S01A cannot mutate S01B | Switch/reload preserves only authorized context |
| S-02 | Station owner | Invite cashier/attendant/HR only approved station | Expired/used/mismatched invite rejected | Cashier cannot invite station owners | Reissue invite preserves one accepted membership |
| S-03 | Station owner | Brand fuel list, enable, price set | Zero/negative/too many decimals or unknown fuel rejected | Station manager cannot modify another station | Repeated update correct current price and historical snapshot |
| S-04 | Cashier/attendant | Scan valid signed station QR and show amount/plate | Malformed/expired/revoked QR rejected | Wrong station/role cannot scan | Camera denied→manual fallback; never double consume |
| S-05 | Customer issuer/pump | Reserve available balance, release on expiry/cancel | At-limit permitted, overlimit blocked | Other company cannot reserve wallet | Concurrent issue/cancel replay updates hold once |
| S-06 | Pump staff | Image private upload→OCR→plate verified | Blurred/mismatch plate asks review | Other station cannot access photo | OCR offline prompts review without authorizing fuel |
| S-07 | Pump staff | Price locked on start; actual settle once | Overcap/negative/invalid meter blocked | Unrelated station cannot finish session | Repeat finish/reconnect never double charges |
| S-08 | Manager | Manager accepts/rejects evidence with reason | Missing reason/double approval blocked | Cashier cannot override supervisor approval | Review rollback not silently alter ledger |
| S-09 | Station owner | Three customer companies per station | Fourth test company refused by fixture boundary | Cross-station membership cannot add customers | Duplicate form/timeout no phantom company |
| S-10 | Station manager + corporate admin | Request→company approve→link with no extra company | Unapproved/expired request remains pending | Other company's admin cannot approve link | Retry approval idempotent; QA relation budget remains 12 |
| S-11 | Station finance/manager | Terms, due date, credit limit and pricing per station | Limit below outstanding/invalid due day rejected | No updates from unrelated station | Terms changes audited; previous invoice snapshot unchanged |
| S-12 | Corporate accountant | Private test slip→pending station bank | Duplicate slip/invalid amount/file rejected | Other company cannot read attached evidence | Upload fail preserves pending without balance credit |
| S-13 | Finance manager and reviewer | Two distinct roles verify an actually evidenced test deposit | Self approve or fake received status rejected | Accountant cannot bypass station verification | Double-approve race credits once, never fake money |
| S-14 | Finance/manager | Debt-first allocation and correct 0/positive totals | Overdraw and satang rounding edge rejected | Cross-company/station ledger read denied | Corrections through append-only reversal, no direct edits |
| S-15 | HR manager | Create employee with correct station and role | Duplicate employee/invalid wage rejected | Station S01A HR cannot read S01B employee | Edit and reload maintain verified staff ID |
| S-16 | HR manager | 3 shifts, allocate one employee | Overlap/night shift/double assignment rejected | Other station cannot assign shift | Concurrent edits preserve one approved schedule |
| S-17 | Employee/HR | Request→manager decision→replacement shift | Already approved/missing coverage rejected | Employee cannot self-approve | Retroactive changes audit without phantom attendance |
| S-18 | Employee/HR | Clock in/out with valid geofence and review | Outside/low GPS accuracy pending or rejected | Other station cannot fake attendance | Network retry doesn't generate duplicate punch |
| S-19 | Employee/HR | Request overtime, approve subset of minutes | Invalid hours, overlap and unreviewed minutes rejected | Requester cannot approve own OT | Reversal leaves payroll linkage and audit correct |
| S-20 | HR/payroll reviewer | Approved shifts and OT→net pay draft | Negative net, invalid deduction, duplicate batch rejected | Cashier cannot finalize or export payroll | Exports simulation only; no bank transfer |
| S-21 | Station owner | Choose authorized plan and payment method | Unentitled/expired plan blocked | Other station cannot choose enrollment | Repeated selection creates one active subscription |
| S-22 | All station roles | Mobile dock/tabs/camera/records keyboard usable | Empty/offline/tiny viewport resilient | Hidden role tabs also denied by API | Resume app not reset unsaved station form |

### Scenario catalog — Corporate (48 planned cases)

| Module | Authorized actor | H: expected business state | V: validation/boundary | R: denied access | F: outage/replay |
|---|---|---|---|---|---|
| C-01 | Corporate admin | Company scope visible after QA sign-in | Unverified/disabled user denied | Other corporate account data hidden | Logout invalidates context |
| C-02 | Corporate admin | Each station sees exactly 3 QA companies | 13th fixture company refused | No accidental cross-station association | Reload preserves 12 relationship inventory |
| C-03 | Corporate admin | Update allowed profile fields and read back | Invalid tax ID/date rejected | Other corporate admin cannot edit profile | Cancelled edit not persisted |
| C-04 | Corporate admin | Invite issuer/accountant/driver and revoke | Expired token/duplicate invite rejected | Driver cannot invite finance manager | Revoke removes access; history immutable |
| C-05 | Corporate admin | Approve existing company station link | Unapproved request not active | Wrong corporate admin cannot approve | Retry doesn't create thirteenth relation |
| C-06 | Corporate accountant | Submit test funding slip and observe pending | Missing slip/incorrect bank/duplicate rejected | Other company cannot see slip | Reject/timeout leaves balance unchanged |
| C-07 | Accountant/admin | Displays prepaid-credit-debt-reserved consistently | Zero/overlimit states safely displayed | Other company's wallet denied | Reload matches ledger not optimistic UI |
| C-08 | Coupon issuer | Valid company/station/plate/amount issues one token | Expired/overlimit/invalid plate blocked | Driver cannot issue as accountant | Replay same key same coupon; release hold once |
| C-09 | Issuer/driver | Active→used OR cancelled/expired | Double-use and conflicting cancel rejected | Other company's actor cannot cancel | New coupon has new ID and no duplicate hold |
| C-10 | Driver/issuer/accountant | Driver views assigned QR; issuer issues; accountant views finance | Invalid assignment remains hidden | Driver cannot approve top-up or edit credit | Role change reflected after renewed session |
| C-11 | Company accountant | Only own company's station receipts/invoices | Empty historical period shows zero | Cross-company query denied | Refresh same immutable transaction refs |
| C-12 | All corporate roles | Mobile login→QR/list/balance functional | Offline/camera denied/invalid input actionable | Hidden tab not API authorization | After recovery reload correct company |

### Cross-cutting (40 planned cases)

| Module | Authorized actor | H: expected business state | V: validation/boundary | R: denied access | F: outage/replay |
|---|---|---|---|---|---|
| X-01 | QA operator | Browser click+submit with screenshot and trace | No screenshot cannot mark UI PASS | No privileged browser service key | Failure evidence stored redacted |
| X-02 | QA operator | Write response verified by SQL and fresh login | Response 200 but DB missing must FAIL | DB evidence must match actor scope | Retry read with consistent snapshot |
| X-03 | All 99 QA roles | Each permitted action succeeds and forbidden denied | Missing membership and revoked role denied | Never authorize by hidden UI alone | Token refresh reflects server role state |
| X-04 | All writable operations | Duplicate key commits one effect | Different payload same key must reject | Unauthorized replay blocked | Timeout recheck existing ID |
| X-05 | Mobile/desktop | Labels, cancel/save, keyboard usable | Overflow/empty/error visible and navigable | No unauthorized tab content leaked | Focus recovers after dialog close |
| X-06 | QA operator | No unhandled JS exceptions or infinite loads | Network outage shows retry | Error response sanitized | No duplicated write on reconnect |
| X-07 | Admin/finance | Actor and timestamp and old/new states recorded | No silent delete/overwrite financial ledger | Unauthorized event read denied | Append-only correction and replay |
| X-08 | QA operator | CI→merge→deploy→public smoke | Failed gate blocks deploy | Finance flags stay OFF | Post-deploy version verified |
| X-09 | Owner | No cleanup until explicit order after all phases | Auto-cleanup job forbidden | No broad delete permission | Protected baseline survives QA |
| X-10 | Owner | Approved enumerated reset, backup, recovery proof | Missing backup blocks reset | No removal of schema/secrets/bootstrap | Verify no QA artifacts and cold login |

## Additional state-machine and transaction invariants

| Business entity | Allowed workflow | Forbidden / collision outcome |
|---|---|---|
| QA account | provisioned → auth confirmed → active → disabled | No public signup, no ability to self-escalate to Super Admin |
| New station | Sales authenticated → org+station+disabled fuel + QR/HR module → active Sales assignment + audit | One DB transaction; third station for same QA Sales denied; retry same request key returns existing station |
| Sales attribution | initial creator effective immediately → scheduled next-local-midnight transfer → expiry of former interval | No overlap/gap for chargeable service days; historical entitlements immutable |
| Plan / invoice | reviewed price/tax → draft → issued → signed **test-paid** or cancelled → reconciled once | A raw browser click or unsigned webhook cannot mark invoice paid |
| Coupon | issued & reserved → scanned/plate verified → fueling → settled; OR cancelled/expired and released | No duplicate charge/hold release, wrong station/plate rejected |
| Top-up | test slip pending → dual-party verified → debt first then prepaid credit | Pending or fake bank evidence never credits wallet |
| Fuel evidence | image uploaded → OCR candidate → human confirmation → approved/rejected | Unverified plate or wrong station never authorizes dispensing |
| Attendance | punch → GPS/evidence review → approved time → OT review → payroll draft | No unapproved hours to payroll; employee never self-approves |
| Payroll | draft → reviewed → locked/export-simulation | Never transfer funds in this QA run |
| Corporate membership | created → issuer/accountant/driver scoped → revoked/disabled | Never access other companies even with guessed UUIDs |
| Final reset | all 3 phases finished → owner orders reset → enumerated plan+verified backup → authorized cleanup → cold-start check | No cleanup by automation or during individual menu testing |

## Phase gates and recording policy

1. **Phase 0 — simulation/read-only:** approved scenario catalog, live baseline counts, QA modes and security flags, TinyFish public login smoke. Node/domain API regressions are isolated and never write live data.
2. **Phase 1 — Platform:** `P-01..P-15`, first QA Super Admin-authenticated provision Sales01/02/support01, then Sales themselves create two stations each. Check creator assignment, audit, own-only list, third-station rejection, price/commission simulation. Use 1 active menu per test.
3. **Phase 2 — Station:** `S-01..S-22`, add 8 organization + 28 station-role accounts. Three companies per station created only by authorized test roles. Block actual money/fuel operations until separately simulated safely.
4. **Phase 3 — Corporate:** `C-01..C-12`, add 60 company-role accounts. Confirm QR/wallet/driver access and cross-company isolation.
5. **Exit:** full role and negative matrix, screenshots, API & Supabase ID evidence, zero unauthorized write. **NO RESET** until owner order; create separate `RESET-PLAN.md`.

### Current blockers that MUST NOT be mistaken for PASS

- QA account switch `OILSTATION_QA_MODE_ENABLED` is OFF on Cloudflare, so no synthetic username login is currently displayed.
- TinyFish is connected but its saved Browser Profile has **no authenticated OilStation session**. Super Admin account provisioning and protected screens cannot be executed yet; authorize/complete a secure TinyFish profile login without sending passwords in chat.
- Production preview `OILSTATION_API_ENABLED=false` blocks financial/fuel/HR APIs by design; secure isolated simulations can pass but live end-to-end cases are BLOCKED until a separately approved test-safe path.
- Existing production account and station data are protected and excluded from QA fixture.

## Evidence

For each scenario, append `<scenarioId,actorRole,actualStationId,actualCompanyId,steps,UI screenshot,API status,DB record IDs,audit,result,fix commit,retest run>` to `docs/qa/runs/QA-20261031-PLATFORM-001.md`, or the corresponding Station/Corporate run. Only label PASS if the real end-to-end evidence exists. Separate simulation evidence goes under a **SIMULATION** column. No secrets/cookies/credentials in git.

