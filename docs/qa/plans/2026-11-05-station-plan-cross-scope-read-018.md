# OS-QA-ST-PLAN-CROSS-SCOPE-READ-018 — guarded scope

- Continue after confirmed [case 017 Chromium PASS 42025889632](https://github.com/nsomprasong/OilStation/actions/runs/42025889632); do not rerun previously successful cases 002–017.
- Authenticate only preexisting `s01a-owner` with restricted single station `e22fb5ff-1878-446f-ab8d-585115e8a1a9` on 390×844 mobile. Target foreign s01b `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- Require own station billing options GET HTTP 200; foreign station GET HTTP **403** with safe `permission_denied`, no data disclosure; same foreign endpoint without auth returns HTTP **401**. Re-read own GET to ensure normal scope remains accessible. No POST or Stripe/HR/finance writes. Any 200 foreign response is **FAIL** and must halt release.
- Workflow: PR CI 12/12 PASS before squash; after merge, guarded Preview success for matching main SHA; protected one-spec Playwright alone. Record real log evidence, do not infer Full Production readiness.
