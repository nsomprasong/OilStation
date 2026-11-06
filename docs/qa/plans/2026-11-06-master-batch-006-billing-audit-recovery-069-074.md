# OilStation — Master TEST-6-006: six guarded billing / audit / retry cases

**2026-11-06.** Six NEW protected Playwright cases 069–074. No prior case rerun. One exact-SHA guarded Production Preview, serial Chromium only after PR CI 12/12.

| Case | Master | Real actor | Scoped acceptance |
|---|---|---|---|
| 069 | P-05-V | sales01 | Invalid missing, negative or fractional SaaS plan prices and impossible effective date reject HTTP 400 before any configuration write |
| 070 | P-06-V | s01b-owner | Live existing SaaS card/PromptPay quote rounded to integer satang with correct 2% QR discount and inclusive/exclusive VAT; invalid tax config rejected 400, selected plan unchanged. **Expired promotion remains untested**, never claim whole master P-06-V complete |
| 071 | P-14-V | sales01 | Duplicate/unknown audit filters, invalid calendar date, bad before cursor all 400 |
| 072 | P-14-F | sales01 | Actual own Sales audit returns descending immutable chronology with read-only cursor before filtering and repeat consistency (may not fill all 50 rows) |
| 073 | S-21-V | s01b-owner | Nonexistent / unentitled plan ID rejected 409, saved owner choice unchanged and no checkout intent; no positive checkout CASE-020 replay |
| 074 | X-06-V | s01b-owner | Simulate network outage specifically on station credit GET after successful load, require visible connection warning / empty rows, retry GET restored, 3 actual company cards recovered |

## Risk and fixture preflight

- Production Supabase before-run read-only counts: `invitations 2; companies 12; audit 260; pricing_plans 3; VAT policies 1; checkout requests 1; coupons 2; payroll runs 0`. Compare independently after run.
- Actual `station_select_saas_plan` checks station owner & no active subscription and calls `station_plan_pricing` **before INSERT**. Reviewed SQL confirms a nonexistent plan ID raises `INVALID_REQUEST` before creating checkout.
- All POST tests are invalid shape/rate or nonexistent plan; no real billing, finance, invoice, coupon, payroll or fuel writes. Browser network outage affects only the test page's GET route interception.
- Master queue reordered with completed 001–005 marked scoped Chromium PASS, **not** automatic full UAT PASS. P-06-V has an additional expired-promotion requirement, which is separately outstanding; positive/unsafe financial prerequisites remain held.
- Require PR CI 12/12 and exact-SHA Guarded Preview success. Only added e2e specs 069–074, **6/6 serial Chromium PASS** to close scoped batch. No auto cleanup.

**Before run:** PENDING.
