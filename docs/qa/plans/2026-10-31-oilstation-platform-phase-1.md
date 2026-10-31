# OilStation — Platform Phase 1 Browser UAT Test Plan

**Plan ID:** QA-20261031-PLATFORM-001
**Master:** QA-20261031-MASTER-001
**Status:** IN_PROGRESS — non-mutating public smoke completed; account-authenticated/writing cases BLOCKED until secure QA entry.
**Environment:** real Cloudflare Production Preview + current Supabase `cxihsotcpdnalswfoysx`.
**Browser:** TinyFish live Browser Agent (connected); authenticated TinyFish Browser Profile currently has **no OilStation login**.
**Scenario source:** `docs/qa/scenarios/oilstation-master-scenarios.json`.
**Execution report:** `docs/qa/runs/QA-20261031-PLATFORM-001.md`.

## Phase 1 scope

Platform P-01..P-15 (15 modules × 4 branches = **60 scenarios**), including the 2 QA Sales accounts individually creating 2 stations each, one QA Platform Support identity, private Sales attribution, scheduled transfers, commission preview, platform plan/tax/finance safeguards, permission denial, all user-facing functional submenu UX.

**Not in Phase 1:** creating 12 companies, 28 station employees/users, 60 corporate users, coupon/fuel/HR/payroll transactions; their catalog scenarios are prepared but executed in Phases 2 and 3. No live money/refunds, outgoing real email, or automated cleanup at any phase.

## Approved fixed entity / permission matrix

| Creator | Auth alias | Allowed new station names | Maximum | Expected attribution |
|---|---|---|---:|---|
| Sales01 | `sales01` | `QA-S01-A`, `QA-S01-B` | 2 | Only Sales01 receives original commission period |
| Sales02 | `sales02` | `QA-S02-A`, `QA-S02-B` | 2 | Only Sales02 receives original commission period |
| Support | `support01` | none | 0 | No commission or privileged station creation |
| Existing Platform Super Admin | actual protected account | Operator; does **not** create QA Sales stations | 0 QA new | Approves scoped QA users; can inspect all four |

Existing production station (1) and two app users pre-date QA and are NEVER fixtures. All 99 new accounts defined by the Master must be created at respective phases after station/company UUIDs are known. Never reuse another role identity.

## Phase 0/1 preconditions and permissions

- [x] Master and role matrix present, 236 planned scenarios recorded.
- [x] Read-only existing DB baseline recorded in run report.
- [x] TinyFish public login smoke executed with browser screenshot/DOM evidence.
- [x] Cloudflare worker safety flags verified: `OILSTATION_API_ENABLED=false`, pilot enabled.
- [ ] Verified backup / **actual restore path** and protected existing object inventory (required before any destructive test; currently NOT VERIFIED).
- [ ] Secure TinyFish Browser Context Profile authenticated as existing Platform Super Admin. Must be set up through TinyFish UI; NEVER provide password in chat.
- [ ] Approved QA run switch enabled with `QA_RUN_ID=QA-20261031-PLATFORM-001` and server-locked scope allowlists. QA mode remains OFF until authorized operator step.
- [ ] 2 QA Sales + 1 Support provisioned from original authenticated Admin via QA console.
- [ ] Subsequent station accounts/organization IDs recorded and server allowlist updated after creation.
- [ ] No credentials, JWT, PII, private screenshots in Git.

**Current write gate:** no authenticated Browser Profile and QA mode OFF. No production test records have been created. The owner's instruction to start testing authorizes *read-only browser + isolated simulations* now, not bypassing credential/profile/recovery controls.

## Platform steps by menu (one at a time)

| Step | Scenarios | Browser role and actions | API/database checks | Current status |
|---|---|---|---|---|
| 1. Public Login | P-01-H/V/R/F + P-15-R | Open guest page, Google/Facebook buttons, invalid token, QA option gated | `/api/public-config`, `/api/me` unauthorized, QA mode off | PARTIAL READ-ONLY |
| 2. QA operator | P-15-H/V/F | Verified Super Admin login, provision only `sales01`, `sales02`, `support01` | Auth users + memberships + audit; no third Sales | BLOCKED |
| 3. Sales 01 | P-02,03,09,10 | Sales01 login; create QA-S01-A/B, invalid brand, second submit same request ID; third rejected | list API only Sales01, assignment time, audit IDs, exactly two | BLOCKED |
| 4. Sales 02 | P-02,03,09,10 | Sales02 login; create QA-S02-A/B; cannot see Sales01 stations | own-only list, no cross Sales, 4 combined | BLOCKED |
| 5. Roles and audit | P-04,14 | Support vs Super Admin vs Sales attempts; station ownership not inferred from Sale | unauthorised API 401/403, no DB delta | BLOCKED |
| 6. Tax/plans | P-05,06 | Admin reviews, creates reviewed quote, invalid promo | VAT/plan snapshots and satang totals | BLOCKED (writes); SIMULATION pending |
| 7. Billing/Stripe safety | P-07,08 | Test mode events only, signed proof, canceled/replayed event | invoices issued only if safe provider, never live payment | BLOCKED live financial release |
| 8. Commissions | P-11,12,13 | Admin transfers a QA station, compare periods in 2 Sales views, no duplicate | paid-only entitlement, correct time split and audit | BLOCKED real paid invoice; SIMULATION pending |
| 9. UI regression | all P | Mobile 360/390/430 + desktop; one menu pane, 5-slot dock, empty/error/cancel | screenshot, console/network, 0 unexpected mutations | BLOCKED authenticated |

## Each scenario's mandatory evidence

- `-H`: actual correct role signs in, opens exact task card, completes flow, UI state is correct, response and DB ID/audit match.
- `-V`: invalid/limit scenario gives specific user-visible error; no incorrect DB write.
- `-R`: unauthorized account or cross-tenant UUID denied **at API**, not merely hidden menu.
- `-F`: duplicate request, retry after timeout, concurrent actor, reload and idempotency; no double charge/duplicate station.

Status values: `PASS` only after observed browser + API + DB evidence, `FAIL` for reproducible mismatch, `BLOCKED` for unavailable authenticated session or protected financial gate, `NOT TESTED` for pending. Domain-only simulation reports must be clearly labeled and NEVER promoted to Browser PASS.

## Phase 1 exit

Every P-01..P-15 scenario either PASS with evidence or is separately escalated as GAP/BLOCKED with a clear remediation. No progression to business-data writes in Station/Corporate until reviewed Phase 1 gate. After any fix: CI+merge+deploy+post-deploy smoke. **No automatic deletion of any QA data.**
