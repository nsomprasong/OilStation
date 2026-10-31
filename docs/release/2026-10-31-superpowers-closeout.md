# OilStation — Superpowers release closeout / factual gate register
Date: 2026-10-31 (Asia/Bangkok)

## Scope and boundary
This closeout checks the existing **Production Preview** and hardens its deployment guard. It does not certify the entire OilStation SaaS for live fueling, banking or payroll. The customer-facing Cloudflare Worker is real, but financial mode must stay off until all independent acceptance gates pass. Never use a green CI run as a substitute for real provider, data or device E2E tests.

## Reconciled evidence (read-only)
- GitHub main inspected at `dc8459fb166d4732c1481427ac784d738cd4e8e1`; Production Preview run [41083831478](https://github.com/nsomprasong/OilStation/actions/runs/41083831478) succeeded.
- Cloudflare Worker `oilstation` deployment version `c100a48c-d1ad-4f05-8bdb-8e9f113d07cc` was listed as 100% on 2026-10-30 UTC. Settings inspection found `OILSTATION_API_ENABLED=false`, `OILSTATION_PREVIEW_LOGIN_ENABLED=true`, `OILSTATION_PREVIEW_OPERATIONS_ENABLED=true`, `INVITATION_EMAIL_ENABLED=true`. Required Supabase and Resend secret **names** exist; neither key validity nor inbox delivery follows from their presence. Do not print secret values.
- Live Supabase project `cxihsotcpdnalswfoysx` returned `oilstation_release_status() = {ready:true,schemaVersion:'20261029215000'}`. This only confirms schema/security prerequisites. There are no Supabase development branches according to `list_branches`. No production DDL or customer writes were performed for this review.
- GitHub tests and database readiness have not demonstrated live OAuth identity flows, independent fuel evidence review, real bank reconciliation, real Stripe test payments and refunds, legally validated payroll, or a verified backup restore.
- External HTTP GET from the available read-only browser failed to establish live `/api/health` and `/api/ready`; use the GitHub runner's actual deployment smoke output for the preview. Do not claim a passing direct browser check.

## Seven Superpowers phases — this *increment* only
1. **Brainstorm:** identified release bypass risk in auto-deployed preview without a readiness-negative assertion.
2. **Plan:** add a non-mutating preview config guard, a negative `/api/ready` HTTP check, and regression coverage.
3. **TDD RED:** added `test/security/production-preview-release-guard.test.mjs`; GitHub Checks [41162792381](https://github.com/nsomprasong/OilStation/actions/runs/41162792381) failed with new expectations prior to implementation.
4. **Implementation:** validate four preview flags before Wrangler deploy; after deployment, require readiness status 503 and JSON `ready:false`.
5. **Debugging:** no real money or customer data used; review any CI issues and correct only proven failures.
6. **Verification:** requires successful new branch Checks + the seven isolated SQL workflows. A real production-preview smoke run occurs only after reviewed merge and will itself trigger a preview redeployment; record its exact URL and conclusion then.
7. **Code review:** verify the diff is limited to regression test and preview workflow, with a human PR review before merge. Do not self-certify independent approval.

## Gates still requiring external evidence before full go-live
- **Auth:** invite-only Google/Facebook real logins, invited-email OTP when provider email differs, successful inbox receipt/bounce processing, tenant A/B and revoked-user negative tests.
- **Station fueling:** real owner + independent supervisor, private photo capture and review, successful/failed pump and receipt OCR, locked settlement and simultaneous coupon operations, no duplicate ledger postings.
- **Finance:** real independent bank statement comparison, Stripe *sandbox* payment/webhook/refund/dispute recovery; customer money remains disabled until each relevant subsystem is reconciled.
- **HR:** Thailand labor-law reviewed wage/tax/SSO rules, signed privacy/PDPA policy and explicit biometric consent if applicable, test payroll export; no live payroll disbursement.
- **Operations:** isolated staging database (provider quoted cost requires explicit approval), tested backup/restore and rollback, real mobile/desktop UAT, alerting, runbooks and independent release approver.

## Operational decision
**HOLD FULL PRODUCTION RELEASE.** Keep `OILSTATION_API_ENABLED=false`; never set it to true merely because `oilstation_release_status().ready` is true. Preview access must not imply permission to move money. The above blocked gates are independent of the code-only Superpowers increment.
