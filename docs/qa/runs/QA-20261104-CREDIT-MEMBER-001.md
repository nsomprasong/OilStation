# OilStation — Scoped credit, completed fuel and two-directory verification

**Run ID:** QA-20261104-CREDIT-MEMBER-001  
**Linked approved plan:** `docs/qa/plans/2026-11-04-station-credit-member-directory.md`  
**Target:** `https://oilstation.goldensoft.cloud` (production preview; not full financial release)  
**Database:** existing production Supabase `cxihsotcpdnalswfoysx`  
**Date:** 2026-11-04 (UTC+7)  
**Mode:** READ_ONLY_PRODUCTION_DB + isolated CI / unauthenticated Chromium  
**Backup:** NOT VERIFIED; no destructive test, schema reset, payroll update or QA fixture creation performed.

## 1. Read-only production baseline

- `corporate_station_accounts`: 12 rows, `fuel_sessions` completed with `finished_at`: 2 rows.
- `memberships`: 100 rows, `employees`: 3 rows, `payroll_lines`: 0 rows.
- Existing production migration `station_credit_plate_report_member_directory_20261104` installed. The five new database functions are only executable by `service_role`, not `anon` or `authenticated`.
- Nonmutating RPC invocations using an active, authorized station actor returned 3 live customer credit accounts and 2 live completed fuel records; separately tested an authorized station directory read. These checks never copied names, emails, tokens or plate identifiers into this file.
- Worker deployment version/flags after merge: NOT YET VERIFIED in this report.

## 2. Browser and API evidence

| Test | Runner / role | Evidence | Status |
|---|---|---|---|
| Node API and adapter error propagation | GitHub Actions Checks on PR #142 | `test/api/station-operations.test.mjs`; verifies blocked future shift, active driver coupon, protected role codes and 409 responses | PASS |
| Fuel and cross-module finance SQL | Isolated GitHub Actions Postgres | PR #142, Full Public Schema + Fuel + Finance jobs | PASS |
| Responsive browser layout | GitHub Actions local-preview Chromium (320/390/1024/1440) | PR #142 Emerald Cream Local Preview Browser workflow | PASS in completed green run; re-check after latest head |
| Anonymous auth boundary and public navigation | GitHub Actions Playwright Browser E2E | PR #142, @public suite | PASS |
| Signed-in station admin/customer report/HR interaction | Real production browser with role credentials | No authenticated production browser run in this report | NOT TESTED |
| Production deployment and user journey | Live domain after merge | Requires post-merge preview deployment + smoke checks | NOT TESTED |

The automated browser suite is not evidence that a real station owner used the new tables against live Supabase. No financial settlement, debit, top-up or payroll processing was attempted.

## 3. Defects and repairs

- **DEF-001**: Supabase `FUTURE_SHIFT_EXISTS`, `DRIVER_HAS_ACTIVE_COUPON` and protected-role failures were mapped to a generic service error, so the UI could show an infrastructure failure instead of a specific blocked action. Corrected the service-code allowlist and HTTP 409 mapping in `src/adapters/supabase.mjs` and `src/api/station-operations.mjs`.
- **DEF-002**: The initial regression test invoked the adapter outside its `db` namespace and its conflict check used the wrong error field. Corrected both; the final `Checks` run is required to be green before merge.
- Payroll and attendance history are never deleted by the new membership/employee RPCs; employee deactivation is blocked for future scheduled shifts.

## 4. Created objects and external effects

| Service | Newly created fixture IDs | Cleanup | Status |
|---|---|---|---|
| Supabase/PostgreSQL | None | None required | NOT TESTED (no writes) |
| Supabase Auth / Sessions | None | None required | NOT TESTED (no writes) |
| Storage | None | None required | NOT TESTED (no writes) |
| Financial ledger, payroll, payments and notifications | None | None required | NOT TESTED (no writes) |

No database reset or cleanup authorization was used. Protected existing records are preserved.

## 5. Release gates

| Gate | Evidence | Status |
|---|---|---|
| Migration present in real database and five RPC execute ACLs restricted | Supabase migration list + pg_proc privilege query | PASS |
| Authorized, nonmutating live RPC reads | Supabase SQL summary counts | PASS |
| Latest-head isolated CI and Chromium | GitHub PR #142 Actions | VERIFY BEFORE MERGE |
| Merge on verified green HEAD | GitHub PR #142 | PENDING |
| Production-preview automatic Worker deploy | GitHub `OilStation Production Preview` on main | PENDING |
| Authenticated production browser per-role journey | Scoped station/corporate/HR sign-ins, API and DB evidence | NOT TESTED |
| Full finance/payroll release | Separate controlled production approval required | BLOCKED BY RELEASE GATE |

**Current verdict:** automated checks and database reads have evidence, but customer-facing release and authenticated E2E cannot be claimed complete until independently observed. The repository's `OILSTATION_API_ENABLED=false` financial safeguard must remain unchanged during the normal preview deploy.
