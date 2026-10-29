# OilStation release gate status — 2026-10-30

**Overall: DEVELOPMENT PROGRESS, NOT A RELEASE.** Current customer-facing
oilstation.goldensoft.cloud runs a separate maintenance placeholder.

| Gate | Verified evidence | Still required |
| --- | --- | --- |
| Internal Node tests | 233/233 PASS at b5f2ac3a | Real browser/device UAT |
| Isolated PostgreSQL | Fuel, Billing, HR Attendance, Topup, Cross Finance, OAuth OTP and 65-table migration parity PASS | Real isolated Supabase Auth/Storage, tenant data and DDL migrations |
| Frontend/Worker build | Vite and Wrangler dry-run PASS | Authorized, verified Worker deployment and rollback |
| Invitations | Token scope, OTP proof, optional outbound mail code tested | Verified sending domain/Resend secret; Google/Facebook OAuth live end-to-end; bounced mail |
| QR fueling | Atomic holds, photos and settlement transactions simulated | Actual pump device, OCR/photo, supervised exception and race/load tests |
| Corporate top-up | Private slip, manager review and debt-first SQL tested | Real bank confirmation/reconciliation with separate staff |
| Stripe billing | Test-mode intent, signed webhook and lock-order tests simulated | Actual Stripe sandbox payment and refund, legal VAT review, group-billing UAT |
| HR/Payroll | Shift, GPS review and payable=false previews tested | Thailand legal, PDPA/biometrics, withholding/social security, real payroll bank exports |
| Compliance/release | RLS/grants and static threat gates audited | Backup/restore drill, operational controls, legal approval and explicit production release |
| Staging | 65-table metadata-shaped disposable PostgreSQL passed | Supabase branch **cost approval required**; no billed branch created |

## Explicit approvals / configurations outside repository

1. **Supabase staging branch:** the provider requires an approved hourly branch
   cost before creation. No cost has been approved or charged by this workflow.
2. **Google/Facebook OAuth:** configure approved client credentials and redirect
   URIs in the selected Supabase project and identity providers.
3. **Invitation sender:** verify sender ownership/SPF/DKIM and put
   INVITATION_EMAIL_ENABLED, INVITATION_FROM_EMAIL and RESEND_API_KEY into
   encrypted Cloudflare Worker settings. Keep email sending disabled until verified.
4. **Stripe and bank:** create isolated test-mode credentials, dedicated test
   account, and separate people for evidence review. Do not enable live charges.
5. **Thai payroll/PDPA:** qualified legal/payment review before calculating
   salaries, withholding taxes or collecting biometric templates.

No production merge, migrations, Worker deploy, bank payment or real mail has
occurred in this continuation. The developer has not claimed a finished release.


## Further gates added — refund safety and organization HR

- The Stripe Worker does not acknowledge unsupported signed
  refunds/disputes/cancellations as reconciled. Such events remain in the
  signed test inbox and receive HTTP 503 until an audited financial recovery
  handler is added. **No real refund/chargeback reconciliation yet.**
- Organization owners can manage their own station shift creation and
  scheduling through role-checked database RPCs, with regression coverage
  proving another organization's staff and templates remain inaccessible.
  Work remains to expose a complete owner-facing multi-station HR selector.
- Full-schema sequential migration count is now 28 unapplied developer SQL
  files; production applied migration count remains 30.
- EIGHT isolated GitHub Action workflows, 225 Node tests, frontend build and
  Wrangler dry run PASS at ebe8cac6. External test accounts and approved
  Supabase staging are still required before an end-user test.



## Deployment preflight automation added (Oct 30)

- The latest production-shaped PostgreSQL migration `20261029215000_release_readiness.sql` adds a read-only, service-role-only release probe requiring new fuel, finance, HR and invitation RPCs; private evidence/slip buckets; no direct browser table CRUD; and blocked legacy finance entrypoints.
- Worker now exposes separate `GET /api/ready`. With no secrets or release flag, it returns 503, does NOT expose credentials, and all business API routes and Cron jobs remain disabled. `/api/health` does not claim application readiness.
- `wrangler.jsonc` now includes isolated `uat` environment and `oilstation-uat` Worker, with no scheduled tasks or production domain. Production `oilstation` Worker and domain are not modified.
- Added a manual GitHub Actions controlled deploy workflow. It builds, tests, dry-runs, requires environment secrets and a database readiness proof before production upload, then probes the deployed domain. The production path also requires the main branch and a specific release approval phrase.
- The manual workflow is on an unmerged PR; GitHub must first merge it to the default branch before it becomes available from Actions. Avoid merging until deployment approvals and external staging evidence exist.
- Verified at `b5f2ac3a`: 233/233 Node tests, Vite build, both UAT and production Wrangler dry runs and all 8 existing isolated SQL/Checks workflows PASS.
- Connected Cloudflare account shows domain oilstation.goldensoft.cloud bound to Worker oilstation with **no secret bindings**. The current customer-facing Worker is unchanged; Supabase still has 30 applied historical migrations and 28 pending developer migrations.
- **BLOCKED**: Owner must explicitly approve billed Supabase staging cost and configure scoped Cloudflare GitHub secret and isolated Worker connection secrets. No full deploy has occurred.


## UAT Cloudflare Canary actually provisioned

- Cloudflare `oilstation-uat` Worker uploaded and deployed through its authenticated API on October 29 UTC / October 30 Bangkok time. GitHub tracked code is in `ops/uat-canary.mjs`.
- Deployment ID: `330e0c21-352e-44e2-aae7-59fe6287048b`; deployed version ID: `fbaab272-90a6-453d-8f92-e5d61418bbe4` at 100% allocation.
- Workers.dev subdomain was enabled; expected address: https://oilstation-uat.nsomprasong.workers.dev/ . The canary intentionally returns `status:provisioned_only` and `/api/ready` HTTP 503. It contains **no OilStation application, Auth, assets, service secrets or financial APIs**.
- Cloudflare API confirms the UAT deployment and that the customer domain oilstation.goldensoft.cloud is still mapped to the original Worker `oilstation` (production version `be695d4c-7e64-483e-b170-733586fa5154`). It was not replaced.
- External HTTP smoke checks from the current web tooling were not accessible; do **not** claim end-user reachability based solely on Cloudflare API state. The owner or a connected runner must verify that endpoint.
- The manual GitHub Actions `uat` deployment will replace the canary with the real built application only after the code is reviewed/merged and a scoped GitHub Cloudflare token has been configured. Staging database secrets and approval are required before enabling business APIs.
- Latest isolated CI at dc52b4a8: **234/234 Node tests PASS**, frontend build and both Wrangler Worker dry-runs PASS, **all eight workflows PASS**.
