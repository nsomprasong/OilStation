# OilStation — Playwright real-browser QA runbook (31 Oct 2026)

This supersedes TinyFish for ALL NEW UAT. Existing historical TinyFish evidence remains historical; no old browser case is promoted to Playwright PASS. Uses **main**, the existing `cxihsotcpdnalswfoysx` Supabase DB, `oilstation.goldensoft.cloud`, and the 236-case/59-category Master Catalog. No staging project, no synthetic mocks as browser evidence.

## Verified read-only baseline
- GitHub main at implementation time: `716d72921f1c3454ac9d33fff4db7f8e0eec517f`.
- Exactly 3 QA stations exist: QA-S01-A, QA-S01-B, QA-S02-A, with 3 active Sales assignments / 3 creation requests / 3 sales_station_created audit events.
- Sales01 owns A+B; Sales02 owns S02-A. Protected pre-existing station `ทดสอบ1` remains unchanged.
- 0 corporate companies, 2 QA Sales users. Support01 not yet provisioned; no auto-creation of any other fixture. No automatic cleanup.
- QA mode was activated by the owner. Production finance APIs remain disabled.

## Safe execution order
1. PR Browser workflow runs **public** Chromium at 390 px/desktop on the real domain with no secrets and uploads screenshots/traces. This does NOT prove authenticated UAT.
2. Merge only after checks + public browser PASS. Existing `production-preview.yml` deploys on main. Verify deployment success before authorized runs.
3. GitHub > Settings > Environments > **oilstation-qa**: restrict deployment branches to **main**, require maintainer reviewer; add **Environment Secrets** listed below. In workflow Actions > OilStation Playwright Browser E2E > Run workflow (main), choose `authorized-platform`. Set `allow_missing_station_creation=true` ONLY after verifying current three-record baseline.
4. Protected job logs in as real Sales02 (password from secret), verifies own-only station API; if (and ONLY if) the preflight exactly matches the frozen 3-station fixture, clicks the actual Sales form to create **QA-S02-B**. Then rechecks browser, API, DB, audit, request ID, Sales01 privacy. If QA-S02-B already exists, test is read-only and confirms four records. Never create a fifth station; no third-station mutation test is enabled on live data.
5. Protected trace/screenshots and HTML report are **GPG AES256 encrypted before upload** because this is a public repository. Download encrypted artifact, decrypt only in an authorized secure location. Never paste credentials, JWT or trace contents into issues, commits or chat.
6. Update `docs/qa/runs/QA-20261031-PLATFORM-001.md` with the actual Actions run URL, new UUID, DB/API/Browser/audit results. Then complete P-01..P-15 scenarios or mark each missing capability BLOCKED/GAP, before Station then Corporate. Do not seed companies or accounts in this first workflow.
7. Test Support01 provisioning separately as the existing Super Admin through the real QA console; authentication for that actor cannot be fabricated or elevated by this Playwright script.

## Required protected secrets (names only; values NEVER in Git or output)
- `OILSTATION_QA_SALES01_PASSWORD`, `OILSTATION_QA_SALES02_PASSWORD`: passwords for the **existing** scoped QA accounts.
- `OILSTATION_QA_DB_KEY`: protected server-side Supabase secret/service key, only read-only REST SELECT executed in the Node runner. Never in browser, never PR workflow.
- `OILSTATION_QA_EVIDENCE_PASSPHRASE`: strong independent secret to encrypt private browser traces before the public repository artifact upload.

Only `workflow_dispatch` from `main` can run the protected suite; PRs cannot access these secrets. This workflow does not reset any QA data, create companies, provision 99 users, activate money APIs, or execute external payments.

**Evidence rule:** No PASS without Actions run, actual browser behavior, API results, authoritative Supabase and matching audit. Failed/missing-secret/blocked runs remain FAIL/BLOCKED. An encrypted archive is not evidence of test PASS by itself.
