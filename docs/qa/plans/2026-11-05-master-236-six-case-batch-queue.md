# OilStation — Master UAT 236: evidence crosswalk and six-case execution batches

**Snapshot:** 2026-11-05 · source `main` commit `666f1466cd9c2858587a75544f180aa59de7a807` · target existing guarded Production Preview + existing Supabase (no staging) · documentation-only reconciliation, **NO CASE IN THIS QUEUE HAS BEEN RERUN**.

## Assessment rules

The [canonical 236 Master scenarios](../scenarios/oilstation-master-scenarios.json) still all say `NOT TESTED` because they did not ingest evidence. This new [machine-readable crosswalk](../scenarios/oilstation-master-236-evidence-crosswalk.json) is the **new audit overlay**, not a silent rewrite of historical Master results. It examines real protected QA Chromium, API/SQL/audit and safeguards; a previously passed numbered CASE-001–038 is **not automatically equivalent** to one of the differently named Master IDs.

- **PASS:** full narrowly written Master acceptance verified with authenticated browser/API/DB or, for release-only negative gates, matching guarded deployment proof. No unproved money movement claimed.
- **PARTIAL:** credible related QA evidence, but at least one required actor, step, response, database/audit or recovery assertion is still missing. **Must finish missing assertions; do not repeat completed substeps.**
- **NOT_TESTED:** no direct execution evidence matching the variant.
- **BLOCKED:** known release guard, missing reversible synthetic fixture, genuine HR actor, backed-up recovery or owner-only reset. **Do not launch these in ordinary Batch QA.**
- **SPEC_UPDATE_REQUIRED:** historical catalog conflicts with approved current requirements (photo-only instead of OCR; 98 QA actors excluding Support).
- **SKIPPED_BY_OWNER:** platform Support / `support01` authenticated tests expressly excluded, not counted as PASS.

## Exact counts

| Section | Master | PASS | PARTIAL | NOT_TESTED | BLOCKED | SPEC_UPDATE | SKIPPED |
|---|---:|---:|---:|---:|---:|---:|---:|
| Platform | 60 | 4 | 29 | 8 | 15 | 2 | 2 |
| Station | 88 | 2 | 35 | 12 | 37 | 2 | 0 |
| Corporate | 48 | 2 | 16 | 13 | 17 | 0 | 0 |
| CrossCutting | 40 | 2 | 22 | 9 | 7 | 0 | 0 |
| **All** | **236** | **10** | **102** | **42** | **76** | **4** | **2** |

**Still needing actual acceptance work: 144=144 Master cases**, queued as **24 exactly-six-case rounds**. **76 blocked** are separated into 13 HOLD groups (12 full groups + 1 remainder of 4, which is **never executable as a test batch**). **4 spec updates** and **2 owner skips** are outside the test queue. The 10 exact PASS cases must not be blindly rerun.

**Exact PASS Master IDs**: `P-02-H`, `P-02-R`, `P-08-R`, `P-10-H`, `S-17-H`, `S-19-H`, `C-01-H`, `C-02-H`, `X-08-H`, `X-08-R`. Every individual entry has the grounded evidence report, Actions URL and scope qualifications in the JSON overlay.

## Execution queue — six NEW Master IDs per round

Each row is a **plan, NOT execution evidence**. Rows are ordered to begin with a read-only/security/reload round and then respect historic Master order. Before each round, review individual specs, role identity, safe endpoint, fixtures and database baseline. A case needing accepted business writes moves to HOLD until a verified reversible test lane exists.

| Round | Master IDs to finish (6 each) | Readiness |
|---|---|---|
| `TEST-6-001` | `P-01-R` · `P-09-V` · `S-01-V` · `C-01-F` · `C-02-F` · `X-08-F` | Scoped read-only preflight needed |
| `TEST-6-002` | `P-01-H` · `P-01-V` · `P-01-F` · `P-02-V` · `P-02-F` · `P-03-H` | Review role/API/rollback per case before run |
| `TEST-6-003` | `P-03-V` · `P-03-R` · `P-03-F` · `P-04-H` · `P-04-V` · `P-04-R` | Review role/API/rollback per case before run |
| `TEST-6-004` | `P-05-H` · `P-05-V` · `P-05-R` · `P-06-H` · `P-06-V` · `P-06-R` | Review role/API/rollback per case before run |
| `TEST-6-005` | `P-07-R` · `P-09-H` · `P-09-R` · `P-09-F` · `P-10-V` · `P-10-R` | Review role/API/rollback per case before run |
| `TEST-6-006` | `P-10-F` · `P-11-R` · `P-12-R` · `P-13-H` · `P-13-V` · `P-13-R` | Review role/API/rollback per case before run |
| `TEST-6-007` | `P-13-F` · `P-14-V` · `P-14-F` · `P-15-R` · `P-15-F` · `S-01-H` | Review role/API/rollback per case before run |
| `TEST-6-008` | `S-01-R` · `S-01-F` · `S-02-H` · `S-02-V` · `S-02-R` · `S-03-H` | Review role/API/rollback per case before run |
| `TEST-6-009` | `S-03-V` · `S-03-R` · `S-04-H` · `S-04-V` · `S-04-R` · `S-04-F` | Review role/API/rollback per case before run |
| `TEST-6-010` | `S-05-R` · `S-06-V` · `S-06-R` · `S-07-R` · `S-08-R` · `S-09-H` | Review role/API/rollback per case before run |
| `TEST-6-011` | `S-09-V` · `S-09-R` · `S-09-F` · `S-10-V` · `S-10-R` · `S-11-H` | Review role/API/rollback per case before run |
| `TEST-6-012` | `S-11-V` · `S-11-R` · `S-12-R` · `S-13-R` · `S-14-R` · `S-15-R` | Review role/API/rollback per case before run |
| `TEST-6-013` | `S-16-V` · `S-16-R` · `S-17-R` · `S-17-F` · `S-18-R` · `S-19-R` | Review role/API/rollback per case before run |
| `TEST-6-014` | `S-19-F` · `S-20-V` · `S-20-R` · `S-21-V` · `S-21-R` · `S-22-H` | Review role/API/rollback per case before run |
| `TEST-6-015` | `S-22-V` · `S-22-R` · `S-22-F` · `C-01-V` · `C-01-R` · `C-02-V` | Review role/API/rollback per case before run |
| `TEST-6-016` | `C-02-R` · `C-03-V` · `C-03-R` · `C-04-H` · `C-04-V` · `C-04-R` | Review role/API/rollback per case before run |
| `TEST-6-017` | `C-05-V` · `C-05-R` · `C-07-H` · `C-07-V` · `C-07-R` · `C-07-F` | Review role/API/rollback per case before run |
| `TEST-6-018` | `C-08-R` · `C-10-H` · `C-10-V` · `C-10-R` · `C-11-H` · `C-11-V` | Review role/API/rollback per case before run |
| `TEST-6-019` | `C-11-R` · `C-11-F` · `C-12-H` · `C-12-V` · `C-12-R` · `C-12-F` | Review role/API/rollback per case before run |
| `TEST-6-020` | `X-01-H` · `X-01-V` · `X-01-R` · `X-01-F` · `X-02-H` · `X-02-V` | Review role/API/rollback per case before run |
| `TEST-6-021` | `X-02-R` · `X-03-H` · `X-03-V` · `X-03-R` · `X-03-F` · `X-04-H` | Review role/API/rollback per case before run |
| `TEST-6-022` | `X-04-V` · `X-04-R` · `X-05-H` · `X-05-V` · `X-05-R` · `X-05-F` | Review role/API/rollback per case before run |
| `TEST-6-023` | `X-06-H` · `X-06-V` · `X-06-R` · `X-06-F` · `X-07-H` · `X-07-V` | Review role/API/rollback per case before run |
| `TEST-6-024` | `X-07-R` · `X-08-V` · `X-09-H` · `X-09-V` · `X-09-R` · `X-09-F` | Review role/API/rollback per case before run |

### First planned batch (`TEST-6-001`) — 6 safe checks, not yet executed

| Master ID | Outstanding acceptance / safety notes |
|---|---|
| `P-01-R` | Unauthenticated API + direct Admin deep-link denial; don't repeat already-passed generic 401 alone |
| `P-09-V` | Nonexistent `sales03` QA alias denied; no new login account provisioned |
| `S-01-V` | Bad and missing station ID rejected by scoped read route; zero station writes |
| `C-01-F` | Corporate logout removes private client context and cannot show data on reload; don't assume server invalidates already issued JWT immediately |
| `C-02-F` | Browser reload preserves actual fixed 12-company relationship inventory; verify own-node scope, don't create a 13th |
| `X-08-F` | Verify guarded deploy revision and exact GitHub SHA with verifiable deployed-version evidence; no release flag changes |

**Runner adaptation before first execution:** the existing GitHub workflow currently accepts **2–6** new `qa.case-*.pw.mjs` files. Change it together with the **first six new specs** to **exactly 6 unique Master IDs** and keep `workers=1`, exact SHA-matching guarded Preview, explicit result and DB checks. **Do not merge a workflow-only change that would cause a failing/no-op QA run.** One merged PR/Preview per six new Master cases; no re-running previously passed specs, no finance release flag edits.

## BLOCKED — hold separately, do NOT run until prerequisites are proven

| Hold group | Master IDs / still blocked | Count |
|---|---|---:|
| `HOLD-6-001` | `P-04-F` · `P-05-F` · `P-06-F` · `P-07-H` · `P-07-V` · `P-07-F` | 6 |
| `HOLD-6-002` | `P-08-H` · `P-08-V` · `P-08-F` · `P-11-H` · `P-11-V` · `P-11-F` | 6 |
| `HOLD-6-003` | `P-12-H` · `P-12-V` · `P-12-F` · `S-02-F` · `S-03-F` · `S-05-H` | 6 |
| `HOLD-6-004` | `S-05-V` · `S-05-F` · `S-07-H` · `S-07-V` · `S-07-F` · `S-08-H` | 6 |
| `HOLD-6-005` | `S-08-V` · `S-08-F` · `S-10-H` · `S-10-F` · `S-11-F` · `S-12-H` | 6 |
| `HOLD-6-006` | `S-12-V` · `S-12-F` · `S-13-H` · `S-13-V` · `S-13-F` · `S-14-H` | 6 |
| `HOLD-6-007` | `S-14-V` · `S-14-F` · `S-15-H` · `S-15-V` · `S-15-F` · `S-16-H` | 6 |
| `HOLD-6-008` | `S-16-F` · `S-17-V` · `S-18-H` · `S-18-V` · `S-18-F` · `S-19-V` | 6 |
| `HOLD-6-009` | `S-20-H` · `S-20-F` · `S-21-H` · `S-21-F` · `C-03-H` · `C-03-F` | 6 |
| `HOLD-6-010` | `C-04-F` · `C-05-H` · `C-05-F` · `C-06-H` · `C-06-V` · `C-06-R` | 6 |
| `HOLD-6-011` | `C-06-F` · `C-08-H` · `C-08-V` · `C-08-F` · `C-09-H` · `C-09-V` | 6 |
| `HOLD-6-012` | `C-09-R` · `C-09-F` · `C-10-F` · `X-02-F` · `X-04-F` · `X-07-F` | 6 |
| `HOLD-6-013` | `X-10-H` · `X-10-V` · `X-10-R` · `X-10-F` | 4 |

Blockers by root cause (mutually exclusive at case level):

| Blocker | Cases | Unblock requirement |
|---|---:|---|
| QA_BILLING_GATE | 15 | Isolated approved billing/test-payment and commission fixture, reversal verification |
| REVERSIBLE_FINANCE_FUEL_FIXTURE | 23 | Signed QA-only wallet, QR, pump and reviewer fixture with compensation and no real bank/fuel |
| HR_QA_ACTOR_AND_RECOVERY | 12 | Authorized HR actor/test lane, shift/payroll policies, supported recovery, no salary payment |
| POSITIVE_CHECKOUT_020 | 2 | Disposable station checkout fixture and independently verified restore, especially `S-21-H/F` |
| CORPORATE_FINANCE_FIXTURE | 17 | Isolated corporate top-up/QR/link/revoke test fixture and proven rollback |
| BACKUP_RESTORE_OR_OWNER_ORDER | 7 | Rehearsed backup/recovery and explicit owner approval for destructive reset |

## Specification updates and exclusions

- `P-15-H`, `P-15-V`: original 99-actor/weak-password text conflicts with current approved **98 QA actors**, with Support01 explicitly excluded and temporary QA password policy isolated from production auth.
- `S-06-H`, `S-06-F`: original OCR requirements are obsolete. Rewrite into **photo-only plate evidence + manual approval** before testing.
- `P-14-H`, `P-14-R`: Support-only authenticated branches **SKIPPED_BY_OWNER**; retain independent Admin/audit tests, no Support account creation.
- Current `CASE-020` remains blocked; do not claim checkout success from denied owner-role requests. Production Preview is still **not Full Production**, and all 236 business obligations have **not** been verified.

## End-of-round controls

For a six-case execution, require (a) exact six mapped Master IDs and six fresh bounded scenario specs; (b) per-case PASS/FAIL/BLOCKED logs with API and scoped browser checks; (c) 12/12 PR CI; (d) one matching guarded Preview deployment; (e) protected Chromium six cases all PASS or accurately record failures; (f) independent same-scope Supabase before/after; (g) evidence link & reviewed mapping update. Never turn a blocked or partial scenario into PASS merely because its PR/SQL job succeeded. No automatic production data cleanup; user orders cleanup only after all UAT.
