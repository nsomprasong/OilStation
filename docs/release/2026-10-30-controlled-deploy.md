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
