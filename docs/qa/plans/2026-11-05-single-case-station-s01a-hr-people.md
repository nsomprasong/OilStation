# OS-QA-ST-HR-PEOPLE-001 — one case / one QA identity / one station page

Owner instruction 2026-11-05: **do not rerun all roles or screens together**. Close one isolated, evidence-backed case before beginning another.

## Isolated scope
- Target: guarded OilStation site `https://oilstation.goldensoft.cloud`.
- Role: existing synthetic QA identity **`s01a-owner`** only; station scope `e22fb5ff-1878-446f-ab8d-585115e8a1a9` only; 390 × 844 mobile viewport only.
- Menu: Home → **HR (พนักงานและกะ)** → **People (พนักงาน)**. **No other screen, actor, task tab or business operation** in this run.
- Read-only checks: Login with protected `OILSTATION_QA_REVIEW_PASSWORD` (no literal in repo), confirm `/api/me` role+scope, render HR/People, ensure selected pane and one visible pane, safely read `GET /api/hr/roster?stationId=<fixed QA station>`.
- Expected backend outcome while guarded preview is enabled: the real production HR route explicitly rejects synthetic QA identities with **HTTP 403, error `qa_identity_not_live`**. This is **BLOCKED for actual HR data functionality** and **PASS only for the security boundary**, not a real read success. An unrecognized 403 or other HTTP code is FAIL.
- Do not arm QA UAT, disable release gates, alter memberships, create employee, submit forms, calculate payroll or emit financial actions.

## Read-only baseline before this case (2026-11-05)
- Supabase project `cxihsotcpdnalswfoysx`: 5 stations (the selected fixed QA station exists), 12 companies, wallet ledger 5, fuel sessions 2, payroll runs/payouts both 0, audit events 258.
- The dedicated 98-account Auth rotation run `41970911176` passed 98 password updates, 98 Supabase logins and 98 `/api/me` role checks. Never check in or print the shared QA password, JWT or service key.
- Previous broad browser run `41973619900`: Platform 8/8 PASS, Corporate 32/32 PASS, Station s01a HR returned 403 and the broad Station test exceeded its runtime budget. 66+32 role-isolation browser workflows already passed. **Do not re-execute them** as part of this case.

## Acceptance
1. `CASE_UI_PASS`: QA owner can authenticate and navigate to the **People** tab without console errors; only that pane is visible after UI settles.
2. `CASE_AUTH_PASS`: `/api/me` returns the **specific** station membership for the existing QA account.
3. `CASE_API_BLOCKED`: GET roster returns the expected explicit QA-to-live-HR protection (`403 qa_identity_not_live`), with no unrelated failure. This case **does not meet HR business-function PASS**.
4. Log only fixed synthetic aliases, the URI path (no query or tokens), HTTP status and error code **from strict allowlist**. Never upload plaintext screenshots/video/traces.
5. Compare Supabase row-count baseline after the run to confirm no business mutations.

## Workflow
- New targeted protected Github Actions browser workflow is triggered by *only its own* source files on push to `main`. It does **not** trigger or run `qa-functional-readonly`, `qa-roles-readonly` or `qa-remaining32` because their watched file paths remain unchanged.
- Wait for matching production-preview deploy SUCCESS, then run **one Playwright test** with one identity and one page. Keep default Cloudflare financial gate unchanged.
- Record the observed run ID and exact result separately in `docs/qa/runs/`; do not mark finished before execution.

## Follow-on work (different case; not included)
If the intended outcome is a full QA HR roster read/write, create a separate approved **bounded QA HR lane** case using the existing arm/disarm UAT protections and an exact write/cleanup manifest. Do not make production HR accept QA identities merely to turn this case green.
