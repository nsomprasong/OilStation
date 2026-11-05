# OS-QA-ST-PLAN-QUOTE-READONLY-016

- Continue after PASS cases 001 UI / 002–015 as scoped; NEVER rerun already verified successful UAT.
- Actor existing `s01b-owner` only (390×844 mobile), station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- Read protected `GET /api/station/billing/options`; require 200, at least one real plan with card & PromptPay quotes and a cheaper PromptPay total. If API returns 403/503 or no plans, log **API_BLOCKED / NOT READY**, not business PASS; do not weaken QA/live auth.
- Mobile Home → Plan. Require cards render per API, select one plan as **unsaved draft**; switch card and PromptPay radio; require quoted total changes, VAT/discount presented.
- Absolutely **NO POST** to `/api/station/billing/select`, no charge, no Stripe, no subscription, no plan persistence. Re-read API and assert `selected` unchanged; no unexpected errors.
- Protected one-case Chromium in GitHub Actions only after matching guarded Production Preview; no generic/broad suites, no previous cases rerun.
