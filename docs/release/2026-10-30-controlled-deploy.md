# OilStation controlled Cloudflare deployment

Only after a reviewed merge to main does the GitHub workflow OilStation Controlled Deployment become manually runnable. A successful code deployment is not authorization to process real payments.

## UAT Worker (isolated from the customer-facing domain)

1. Configure a GitHub Environment oilstation-uat with a narrowly scoped CLOUDFLARE_API_TOKEN secret.
2. From main, run the manual deployment workflow with target uat. It builds frontend and Worker, repeats tests, and deploys oilstation-uat with no production domain and no Cron.
3. Check https://oilstation-uat.nsomprasong.workers.dev/api/health (should be HTTP 200). Without OILSTATION_API_ENABLED=true, all API business routes remain disabled even if the app shell loads.
4. Create an isolated Supabase staging project or branch only after cost approval. Apply 28 pending SQL migrations to staging, not production. Configure Worker encrypted secrets SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, COUPON_SIGNING_KEY and OILSTATION_API_ENABLED=true for staging ONLY. The secret names and environments must not be confused with production.
5. /api/ready must be HTTP 200. Test Google/Facebook OAuth, invitation OTP, private evidence, bank approval, Stripe test mode, and actual device workflows before production.

## Production (replaces the existing maintenance Worker)

1. Back up the production database and verify restore/rollback. Complete Thai payroll, PDPA, bank and Stripe reconciliation review.
2. Apply reviewed migrations ONLY after authorized production change approval. Verify production RPC oilstation_release_status() returns ready true with schemaVersion 20261029215000.
3. Create GitHub production environment, require independent reviewers and set CLOUDFLARE_API_TOKEN, OILSTATION_RELEASE_SUPABASE_URL and OILSTATION_RELEASE_SERVICE_ROLE_KEY as encrypted secrets. Never commit key values.
4. Set corresponding Cloudflare production Worker encrypted bindings SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, COUPON_SIGNING_KEY, OILSTATION_API_ENABLED=true. Configure other external providers only after verification.
5. From main choose production and type APPROVED_OILSTATION_PRODUCTION_RELEASE. Workflow checks code, release SQL, required bindings and DB readiness BEFORE upload. It verifies both /api/health and /api/ready AFTER deployment.
6. If post-deploy checks fail, stop traffic and roll back through Cloudflare previous Worker deployment; do not issue live vouchers or move money.

## Actual state as of 2026-10-30

- GitHub Draft PR #1 remains unmerged.
- Cloudflare Worker oilstation is mapped to oilstation.goldensoft.cloud but has no configured secrets.
- Supabase production has 30 applied historical migrations. There are 28 newer unapplied developer migrations (ending 20261029215000).
- No staging branch exists; its creation requires separate hourly cost approval.
- This workflow and migration probes DO NOT create billed staging, merge PR, replace production, send email or move bank funds.


## UAT Cloudflare Canary actually provisioned

- Cloudflare `oilstation-uat` Worker uploaded and deployed through its authenticated API on October 29 UTC / October 30 Bangkok time. GitHub tracked code is in `ops/uat-canary.mjs`.
- Deployment ID: `330e0c21-352e-44e2-aae7-59fe6287048b`; deployed version ID: `fbaab272-90a6-453d-8f92-e5d61418bbe4` at 100% allocation.
- Workers.dev subdomain was enabled; expected address: https://oilstation-uat.nsomprasong.workers.dev/ . The canary intentionally returns `status:provisioned_only` and `/api/ready` HTTP 503. It contains **no OilStation application, Auth, assets, service secrets or financial APIs**.
- Cloudflare API confirms the UAT deployment and that the customer domain oilstation.goldensoft.cloud is still mapped to the original Worker `oilstation` (production version `be695d4c-7e64-483e-b170-733586fa5154`). It was not replaced.
- External HTTP smoke checks from the current web tooling were not accessible; do **not** claim end-user reachability based solely on Cloudflare API state. The owner or a connected runner must verify that endpoint.
- The manual GitHub Actions `uat` deployment will replace the canary with the real built application only after the code is reviewed/merged and a scoped GitHub Cloudflare token has been configured. Staging database secrets and approval are required before enabling business APIs.
- Latest isolated CI at dc52b4a8: **234/234 Node tests PASS**, frontend build and both Wrangler Worker dry-runs PASS, **all eight workflows PASS**.


## Safe read-only Cloudflare ↔ Supabase proof (opt-in; no deploy yet)

Worker source now includes **GET** \`/api/internal/supabase-connectivity\`.
This endpoint is deliberately **disabled** unless BOTH dedicated Worker
encrypted secrets are configured:

- \`OILSTATION_DIAGNOSTICS_ENABLED=true\` (feature switch, kept false otherwise)
- \`DIAGNOSTICS_BEARER_TOKEN\` — independent random 32+ character token, NOT an
  existing Supabase key or OAuth bearer token

Send only an Authorization Bearer header from an approved operator's secure
terminal. Never paste the token into a browser URL, logs, screenshot, PR,
conversation or shell history. Never use a Supabase secret as the diagnostic token.

The probe uses **GET only**: Supabase Auth settings with the publishable key,
and PostgREST \`brand_fuel_products?select=id&limit=0\` with the server key.
It returns only three booleans (\`connected\`, \`publicKeyValid\`,
\`serviceKeyValid\`) and never reads a catalog record or returns credentials.
Response is 404 when disabled, 401 for unauthorized calls, and 503 when
credential or network tests fail. Cross-origin browser requests are blocked.

The existing \`OILSTATION_API_ENABLED=false\` must remain false while the
database is not release ready. The connectivity probe is **independent of
financial API activation**. A connectivity PASS is NOT a production release
authorization and does not apply the 28 pending database migrations.

Only enable and deploy this diagnostic after a reviewed release of this code;
disable/remove the diagnostic credentials immediately after the test. Current
production Worker cannot expose this new endpoint until the code is deployed.

