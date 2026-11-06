# OilStation — TEST-6-010: Corporate credit, driver mobile, tenant and form security

**2026-11-06.** New six Master acceptance cases **093–098** with protected QA aliases only. One GitHub CI gate (12/12), one exact-SHA guarded Production Preview and six-case Chromium serialized E2E. Do not enable or touch real money, Payroll or external billing.

| QA | Master | Login | Real bounded checks |
|---|---|---|---|
| 093 | C-03-V | s01a-owner | Invalid 3-digit tax ID on New Corporate form is rejected client-side (no POST); independently forged invalid taxId via QA-only API rejected 400 and all 3 existing company accounts retained |
| 094 | C-07-H | c01-admin | Authenticated corporate C01 account GET, available = max(0, prepaid + credit limit - debt - reserved), Thai corporate account card and credit banner show exact amount; no credit writes |
| 095 | C-10-V | c01-admin | Well-formed vehicle assignment for nonexistent driver ID gets 403 before insert; approved company driver roster unchanged |
| 096 | C-12-H | c01-driver | Actual mobile (390px) driver screen shows precisely own assigned vehicles + coupon records returned by authenticated /api/driver/coupons, refresh usable, no QR for invalid/expired coupons |
| 097 | S-22-F | sales02 | Unsaved station creation form preserves organization, station, PTT brand and HR check after leaving to Home then returning; Sales keeps exactly 2 stations |
| 098 | X-05-R | c01-driver | Driver HTML only creates Home and Driver screens (not hidden Corporate/finance/HR/Payroll forms); server rejects driver access to corporate roster 403 while own inbox 200 |

## Live Supabase preflight before test

`QA stations=4; corporate station accounts=12; corporate drivers=12; corporate vehicles=12; invitations=2; audit=260; coupons=2; payroll runs=0; total prepaid=2,820 satang`. Require same independently after test. In production SQL `oilstation_assign_driver_vehicle`, exact company-role membership is checked **before** vehicle/driver INSERT, so forged driver UUID gets 403 and cannot create any row. QA corporate preview rejects non-null taxId before touching SQL.

## Coverage caveats

- These are bounded UI, read-only accounting and safely denied API acceptance checks, **not** proof of successful bank topup, live QR settlement, completed Corporate onboarding, payroll or purchased feature gates. Master scenario variants outside these exact assertions remain pending.
- No existing PASS case 039–092 rerun. No new QA users, stations, company links, drivers, coupons, invitations or payroll.
- All six must PASS in a protected real browser, and Supabase pre/post counts must match before marking batch completed.
