---
name: oilstation-live-qa
description: "ChatGPT-driven, plan-first end-to-end browser QA for OilStation against the EXISTING Supabase project, with bounded test writes, evidence-backed pass/fail, cleanup, and production restart/readiness checks. Use whenever asked to test, audit, fix, reset, or release an OilStation menu."
---

# OilStation — ChatGPT Live-Database QA

## Operating contract

- The owner uses **ChatGPT in the normal chat**; **do not require ChatGPT Work**.
- Target web app: `https://oilstation.goldensoft.cloud`; existing Supabase project: `cxihsotcpdnalswfoysx`. The owner does **not** want a separate staging database.
- Browser automation: actual Playwright/Chromium, preferably executed in an authorized GitHub Actions browser runner or connected authorized computer. The ChatGPT assistant coordinates the runner through available tools. **Do not claim you clicked a browser** unless a browser run actually executed and returned observable evidence. Existing Node/SQL tests and worker health checks are not substitutes for browser E2E.
- Plan FIRST. Before first data mutation in any test run, agree the exact menus, role matrix, test IDs, expected results, permitted real-world side effects, test records, cleanup inventory, and deployment expectations in an approved `docs/qa/plans/<date>-<scope>.md`. Use `docs/qa/templates/TEST-PLAN.template.md`.
- No Work mode, paid Supabase staging branch, or unspecified services are prerequisites. If authenticated browser automation is unavailable, mark browser items BLOCKED and report the prerequisite; never simulate PASS.

## Preparation — read-only

1. Verify Git branch, HEAD, remote, production Worker deployment, release flags and authenticated app environment. Preserve security gates.
2. Inspect implementation, migrations and actual reachable UI. Extract user journeys, system dependencies, permissions, validation, transactional invariants, and UX success criteria. Follow `AGENTS.md` and existing design standards.
3. Read-only inventory **before every run**: current row counts, relevant record IDs, existing Auth users, invitations, Storage objects, business transactions, audit events, and any external side effects. Keep a concise masked baseline in the run record; do not output secrets or personally identifying data.
4. Establish an actually verified backup/recovery route BEFORE any destructive test or reset. Merely assuming Supabase backups are available is not verification.
5. Prepare explicitly authorized, independent test accounts for each role. No privileged service key in browser; store runner tokens in secret manager. `playwright/.auth/`, screenshots containing personal data, and traces with authentication must never be committed to Git.

## Scope and safe test data

- Each run gets immutable `QA_RUN_ID` such as `QA-20261031-SALES-001`; test entities get an identifiable QA prefix and their **database IDs** are registered in a run manifest, including all derived records and Storage object paths. Do not delete by name prefix alone.
- On the **same live database**, use serial workers for any writes. Prevent cross-run collisions and stop on unexpected external data mutations. Never use `TRUNCATE ... CASCADE`, `DROP SCHEMA`, broad deletes or global Auth deletion as routine cleanup.
- Do not trigger real payments, refunds, coupon redemption, wallet transfer, payroll, email/SMS notifications to actual customers, or irreversible external side effects unless their exact behavior and exposure were separately authorized in that plan. Test guardrails and validation safely.
- Protect pre-existing admin, user, tenant, business, financial, audit, and compliance records by default. If the owner wants **a fully empty business-state reset** (including records present before QA), create a separate enumerated `RESET-PLAN.md` with backups, preserve/delete matrix, expected row counts, foreign-key dependencies, user confirmation and rollback checks. Do not infer that “delete all test data” authorizes deleting pre-existing records.
- A traceable audit/financial record may be legally or technically append-only; do not silently erase it or call the environment “clean” while test artifacts remain. Report BLOCKED and design an approved remediation route.

## Execution loop: one menu at a time

For each test ID:
1. Open actual browser at correct device viewport, sign in as a permitted test role, visit the specified menu and execute each step (open, add, edit, save, reload, cancel, permission denial, empty/loading/error, mobile layout).
2. Check visible result AND API response AND authoritative Supabase DB state; verify tenant isolation, no duplicate/extra writes, and correct audit effects. Inspect console and failed network requests.
3. Capture sanitized screenshot/trace, API outcome, relevant SQL evidence, and a stable run ID. Mark PASS only when **executed and observed**; FAIL with reproduction steps, BLOCKED for missing prerequisites, NOT TESTED otherwise.
4. On FAIL inspect root cause, patch smallest safe diff, run Node/API/SQL/regression tests and E2E replay. Continue until all approved cases pass or a genuine blocker is documented.
5. Do not change planned business behavior without the owner's new approval. Unexpected UX changes require comparing with the approved expected results.

## Cleanup and return-to-service phase

- Cleanup is a distinct, documented operation **after testing** and before go-live; requires explicit approval of the **exact deletion inventory**, especially on the shared current database.
- Stop test writers and disable any QA-created scheduled tasks, background jobs and outbound test integrations. Export final list of created IDs/paths.
- Delete only approved QA-owned objects using service-specific APIs and DB transactions with foreign-key ordering. For Supabase Storage, use the Storage API (never delete `storage.objects` via SQL). Remove test Auth users through supported Auth administration after their Storage assets and references are handled. Account deletion does not instantly revoke previously issued access JWTs; verify session/auth exposure.
- Requery all tables, Auth, Storage, financial/audit side effects and compare against the approved **post-cleanup baseline**. No “cleanup PASS” if items remain, restore cannot be verified, or pre-existing data changed unexpectedly.
- “Restart the whole system” in this serverless stack means an **authorized clean Cloudflare Worker redeploy/rollout**, cache/browser-session invalidation where appropriate, connection/readiness checks, and a fresh start-to-finish smoke test. A Cloudflare deploy does NOT erase Supabase/Postgres data. **Do not restart the database service by default**: that needs a separate downtime/impact review and authorization.
- Preserve the application's required schema, migrations, secrets, bootstrap admin, login providers, and billing safety gates. Validate cold login, Home navigation, API `/api/health`, permitted API flows, current version, no unexpected QA data and security controls. Claims of complete production financial readiness require separate financial release approval.

## Mandatory reporting and release

- Persist one plan in `docs/qa/plans/` and one `docs/qa/runs/<run-id>.md` using the checked-in templates.
- Every failure gets cause, affected module, fix commit, screenshot/trace reference, and actual retest result.
- Follow agreed OilStation release flow: tests PASS → commit → CI PASS → merge → deploy to the **same approved production preview target** → post-deploy browser smoke PASS. Never bypass worker release gates to make a test pass.
- Final report must distinguish **application deployed**, **browser E2E verified**, **cleanup verified**, **reset complete**, and **go-live approved**. Do not conflate them. Include commit, Actions job/run, Cloudflare deployment ID, outstanding BLOCKED tasks and observed state.
- At first planning discussion use only one conversational clarification if necessary for a destructive scope (e.g. deleting pre-existing organization, station, admin records). Never execute irreversible deletion before that scope is agreed.

## Supporting skills

Use `design-taste-frontend` for operational UX, Supabase skill for auth/RLS/data/storage, Cloudflare/Wrangler skills for worker deployment, and the existing Superpowers workflow for planning and regression fixes.
