# QA-20261105-THREE-GROUP-READONLY-001 — Platform → Station → Corporate, one screen/task at a time

**Scope authority:** owner message dated 2026-11-05 requests completion of all three groups. The first execution is **read-only**. No production release-gate change or unapproved financial action is inferred.
**Target:** https://oilstation.goldensoft.cloud — currently guarded production preview, same existing Supabase `cxihsotcpdnalswfoysx`.
**Runner:** GitHub protected `oilstation-qa` Chromium using existing two QA Sales secrets to derive established synthetic actors. No separate staging.
**Run:** `QA-20261105-THREE-GROUP-READONLY-001`.
**Source:** 236-case master UAT catalogue, existing 98-role evidence and Forest & Gold post-deploy version `d75a6104`.

## Scope, strictly sequential

| Phase | Menus / submenus | QA actors | Read-only acceptance | Prohibited actions |
|---|---|---|---|---|
| 1 Platform | Home; Sales > team/assignment/transfer/commission; Stations > list/create; Activity; Invitations; where authorized Billing | Sales01, Sales02 | Login, scoped /api/me, rendered task panes, tab switching, retry-free GET and error state, desktop and mobile, no cross-Sales leakage | Create station, submit invite, transfer Sales, change plan or pay invoice |
| 2 Station | Home; plan, fuels, pump, customers > credit/new/link/report, finance, HR > people/access/payees/leave/schedule/replacement/OT/pending/approvals, attendance, reviews, payroll, invitations | Four existing QA station owners, plus representative cashier/HR roles | Every authorized page and pane visible and active; no hidden pane overlap; backend release-gate errors reported as BLOCKED; cross-station permission in prior tests remains enforced | Price Save, QR scan, fill, bank approval, membership mutation, payroll payout |
| 3 Corporate | Home; company account > account/topup/QA topup/driver/coupon/report, invitations; driver QR | Twelve fixed corporate admins; selected existing drivers and issuers | Company scope, wallet/driver/QR form mount, each permitted submenu and report, reload/navigation, mobile and desktop | Real slip upload, QR issuance/redemption, coupon hold, bank/Stripe transfer |

## Before-run inventory (read-only, 2026-11-05)

- Cloudflare Worker flags actually read: `OILSTATION_API_ENABLED=false`, `OILSTATION_PREVIEW_OPERATIONS_ENABLED=true`, `OILSTATION_PREVIEW_LOGIN_ENABLED=true`, `OILSTATION_HR_OPERATIONS_ENABLED=true`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`. Never override these as part of this read-only test.
- Supabase RPC `oilstation_release_status()` returned `ready=true`, `schemaVersion=20261029215000`; API /api/ready is nevertheless intentionally 503 while full API flag is false.
- Counts before run: public stations **5** (four selected QA, one out-of-scope), corporate companies **12**, linked accounts **12**, employees **3**, wallet ledger **5**, fuel sessions **2**, topup requests **0**, QA topup records **1**, audit events **258**, payroll policies/periods/runs/lines/payouts each **0**.
- No backup/restore drill has been verified. Therefore **this phase is non-mutating only** and cannot claim full transaction completion; other station and existing records are protected.
- Support01 authenticated user was explicitly excluded in the 2026-10-31 signed QA plan; do not invent a Support account. Platform Super Admin non-QA credentials are unavailable to this runner. These screens remain NOT TESTED in this phase unless separately authorized identity exists.

## Each page and submenu acceptance

1. Authenticate the intended existing fictional QA role; independently verify `/api/me` membership and tenant ID.
2. Open Home then one authorized main menu (from the actual UI). Confirm exactly one visible primary screen, contextual task row and Forest & Gold header.
3. Click each **existing permitted** task submenu individually. Confirm one pressed tab, one displayed pane, all unrelated pane wrappers hidden; preserve DOM. Never click a form submit.
4. Record sanitized page/role/menu, console exception and non-2xx API **path and status only**. Do not log JWTs, IDs in URL query, personal information or full responses.
5. Report `PASS` only if rendered/interaction observed with no unexpected errors; `BLOCKED` for known `503 release_not_enabled`; `FAIL` for incorrect navigation, console crash or unknown error; `NOT TESTED` for inaccessible roles or intentionally unexercised writes.
6. Test 1440px desktop and 390px mobile; evidence is encrypted before uploading and generated only in the authorized runner.

## Release/write limitations

- The 236 scenarios include actual POST/approval/settlement, race, negative cases, retries and cleanup. **This one read-only sweep does not satisfy them**.
- A later non-mutating SQL/worker audit may identify blockers. Mutating QA against the shared production database needs a separate detailed plan, verified recovery and approved side-effect manifest, including exact account IDs, test records and cleanup. Do not activate real finance or bypass release checks to turn a red test green.
- No background automation, live payment, outbound email, bank transfer, physical dispenser use or real staff payroll will be started by this PR.
- If the browser job cannot run because of unavailable protected credentials/environment, mark BLOCKED and keep role-specific tests NOT TESTED.
- GitHub Actions is primary execution evidence; no claim of a successful browser screenshot comparison without the run having completed.

## Test result ledger (to fill after execution)

| Phase | Main menu coverage | Submenu coverage | Browser evidence | Gate |
|---|---|---|---|---|
| Platform | NOT TESTED | NOT TESTED | Pending protected job | READ ONLY |
| Station | NOT TESTED | NOT TESTED | Pending protected job | READ ONLY |
| Corporate | NOT TESTED | NOT TESTED | Pending protected job | READ ONLY |

**Next step after this phase:** triage failures one page at a time, fix smallest source-level diff, rerun protected browser suite and verified DB baseline, then separately plan safe write E2E. Do not mark overall 236-case UAT finished from this sweep.
