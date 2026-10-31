# OilStation QA Identity Mode — Controlled Operator Runbook

**Current status:** Implemented in code, **OFF by default**. No QA users, stations, customers or live transactions have been seeded. It is not a general user registration system.

## Purpose

The owner operates ChatGPT normally (no Work) and validates three scopes against the existing Supabase project `cxihsotcpdnalswfoysx`. Admin-provisioned accounts sign in with a username and strong password instead of requiring a working email/Google/Facebook account. These are **real Supabase Auth users** with email already confirmed by trusted Auth Admin at provisioning and actual membership permissions. Fictional email `qa-<alias>@qa.oilstation.invalid` is never used for outbound mail.

Normal production Google/Facebook and invitation flows are left unchanged; test mode does not disable or bypass the regular Auth verifier. An existing real `platform_superadmin` must authorize creation and provision scoped QA users.

## Enable ONLY after the owner approves the per-menu UAT plan

1. On the **current real Supabase** project, inventory/baseline existing tables, Auth and Storage. Establish a verified recovery/backup procedure. Preserve the existing Super Admin.
2. Approve the four-station/twelve-customer QA fixture. **Do not pre-create stations as Super Admin**: the actual acceptance test requires each Sales user to open its own two station accounts after logging in. Existing non-QA production stations are excluded.
3. Set initial Cloudflare Worker variables/secrets on Worker `oilstation` **through authorized operator controls**, not the public frontend. Stage the allowlist values as empty until their IDs exist:
   - `OILSTATION_QA_MODE_ENABLED=true` (explicit **secret-text** opt-in)
   - `OILSTATION_QA_RUN_ID=QA-YYYYMMDD-MASTER-001`
   - `OILSTATION_QA_STATION_IDS=<S01A_UUID>,<S01B_UUID>,<S02A_UUID>,<S02B_UUID>` (maximum four; configure after Sales self-create)
   - `OILSTATION_QA_COMPANY_IDS=<C01_UUID>,...,<C12_UUID>` (maximum twelve, after customer registration)
   - `OILSTATION_QA_ORGANIZATION_IDS=<approved QA organization UUIDs>` if testing organization roles.
4. In preview, `OILSTATION_PREVIEW_LOGIN_ENABLED=true`, `OILSTATION_API_ENABLED=false` and `OILSTATION_DEPLOY_TARGET=production` must remain as configured. This QA feature **does not** activate payment, coupon settlement, payroll or other release-gated business endpoints.
5. After an approved Worker deployment with these bindings, the guest login view offers a collapsible **เข้าสู่ระบบด้วยบัญชีทดสอบ** form; a real Super Admin Home screen offers a **บัญชีทดสอบ** panel. This form uses Auth's `signInWithPassword` against the existing Supabase Auth project.
6. Through the Super Admin QA panel, create `sales01` and `sales02` (both `platform_sales`). **When the separate Sales self-create feature has been implemented and verified**, each Sales must log in and create precisely two distinct stations. Record the four actual station UUIDs and their originating Sales; then update `OILSTATION_QA_STATION_IDS` server-side. Create exactly three corporate customer relationships per station and update the company allowlist from their real IDs. Only then provision other needed scoped QA roles. Every test account must use real Supabase Auth; the service-role key never reaches the browser.
7. Record the returned Auth user IDs, memberships, company/station IDs and associated audit artifacts in the run report. Store passwords in a private approved secret store, never Git, screenshots or chat transcripts.
8. During QA, changes are verified via actual browser login + API + authoritative DB queries. If an operation is behind a release gate, mark BLOCKED and decide a separately approved test-safe implementation; never bypass finance controls to make a screenshot look successful.

## Disable mode after testing (does NOT delete data)

Turn `OILSTATION_QA_MODE_ENABLED` OFF/remove the explicit secret; the Worker authenticating QA-tagged users then denies their access regardless of existing Supabase session/JWT. UI hides QA login and provisioning. Disabling mode does not delete Auth users, sessions, Storage, memberships, audit entries or transactions. Their exact deletion is a **separate owner-ordered final cleanup only after all tests**, using `RESET-PLAN.template.md`.

## Scope limitations / unresolved requirements

- Existing station creation API/RPC currently permits **Super Admin only**. Requirement is Sales01 and Sales02 must each log in and OPEN two different stations with one originating Sales per station, not share the same stations. Implement and verify Sales self-provisioning with an automatic attribution to the authenticated creator before marking onboarding PASS.
- No simultaneous commission split is required. Verify each new station's recurring commission accrues only to its originating Sales and any subsequent transfer is historical, without double credit.
- The existing browser runner is NOT yet available in this chat. Automated Node tests plus Cloudflare smoke do not prove actual login/password provisioning end-to-end. Record account creation and login as NOT TESTED/BLOCKED until executed.
- Production Preview still blocks full business APIs (`OILSTATION_API_ENABLED=false`) and must remain safe unless the separate release readiness process explicitly approves expansion.
