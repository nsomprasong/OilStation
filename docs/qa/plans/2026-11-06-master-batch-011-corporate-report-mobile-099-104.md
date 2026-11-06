# OilStation — Master TEST-6-011: six new authenticated corporate report and mobile role checks

Date: 2026-11-06. These are **six new Playwright IDs 099–104**, never-run Master cases. Target main e70a73784d48f534a5c55514bd8b34c1dbbcd384 after completed Batch 010 (six PASS); no replay. Scope deliberately differs from prior platform 078–098.

| New case | Master | Real QA actor | Bounded acceptance |
|---|---|---|---|
| 099 | C-11-H | c01-admin | Preexisting **two completed** QA-S01-A-C01 fuel sessions in real API match report UI count, company, plate and positive amount; does not claim invoice checkout |
| 100 | C-11-R | c02-admin | Own C02 fuel report readable, C01 report denied 403 with no disclosure |
| 101 | C-11-F | c01-admin | Refresh same corporate report and API produces identical immutable row IDs/order/amounts without duplicates |
| 102 | C-12-R | c01-driver | Own driver QR 200, but same-company report 403 even if URL forged; no corporate report DOM |
| 103 | S-22-H | s01b-owner | 390px mobile dock five slots, profile, home search, contextual station report and no global horizontal overflow |
| 104 | S-22-R | c01-admin | Own account read 200, station Customer/Plan and platform billing denied 403 and role-inappropriate screen absent |

## Reprioritization and blocked gates

Original `TEST-6-011` P-04-H/V/R, P-05-H, P-06-H, P-07-R were moved **one-for-one** into existing later queue slots from TEST-6-018, 020, 021. They are **NOT PASS**: package entitlement and platform billing authorized-write/owner invoice acceptance are not validated. Issue #205 package change and replacement effective start-date, plus draft PR #208 remain BLOCKED for positive transitions. Master 236 and six-per-batch invariant are unchanged.

## Safety and evidence contract

- Protected real QA login only, one scoped account per spec; no credentials printed.
- `workers=1`, six-case environment `OILSTATION_QA_BATCH_RUN`, PR CI 12/12, matching guarded Production Preview SHA, protected Chromium **6/6**, and independent post-test production SQL.
- No accepted business API POST, credit, fuel, coupon, payroll, subscription, Stripe, or invoice writes. Baseline: 4 QA stations, 12 corporate links, 12 drivers, 12 vehicles, 2 completed fuel sessions, 2 coupons, audit 260, 0 payroll, subscription 1, checkout 1, invoices 1.
- Failure is FAIL/BLOCKED, never recode as PASS; only retry failed case, with deliberate workflow whitelist amendment after root-cause review, not re-run already successful IDs.
- Partial business acceptance cannot be upgraded to universal Master PASS based on a bounded Chromium success.
