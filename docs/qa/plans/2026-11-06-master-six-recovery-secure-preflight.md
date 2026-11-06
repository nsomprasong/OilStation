# OilStation — recovery of the exact six failed Master cases (109,114,116,118,120,127)

Confirmed original browser failures across batches 012–015; this PR modifies only those six failed Playwright specs, targeted preview handlers, guarded workflow and unit tests. Previously verified 18/24 passes MUST NOT rerun.

| Case | Runtime behavior required | Financial / HR safety |
|---|---|---|
| 109 C-07-R | Own company's existing wallet-integrity GET returns readonly SQL snapshot 200; foreign account denied 403 | No ledger update, deposit, or reconciliation |
| 114 S-04-V | QA station cashier invalid signed QR format returns 400; valid-shaped token remains blocked with 503 | Never call inspectQr, no QR reservation/settlement |
| 116 C-10-R | Driver's own inbox 200; QA pending top-up and bank-account details denied 403 | QA finance flag stays false; privileged station pending remains 404 |
| 118 S-15-R | HR QA manager's own entitled roster GET 200; foreign station roster denied 403 | No employee or payroll modification |
| 120 S-16-R | Existing QA HR own roster 200; cross-station shift POST denied 403; same-station POST denied 403 | No write of shift assignment |
| 127 S-11-V | Invalid payment terms and statement close day return 400 invalid_customer while fixture-only restrictions remain | No new company, account or credit |

Four QA stations, twelve companies and a protected QA login only. All successful financial, signed QR and salary APIs remain gated. Exact failed six-only guarded replay under `RECOVERY-012-015`, workers=1; 12/12 CI; same-SHA Guarded Production Preview; require Chromium 6/6 and post-run read-only SQL unchanged.

Next: only after 6/6 begin six **new** Master `TEST-6-016` specs. Package switching with future plan start date remains a release blocker in Issue #205.