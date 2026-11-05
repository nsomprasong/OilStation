# OS-QA-ST-PLAN-SELECTION-INVALID-017 — protected negative billing contract

- Continue after verified 016 (real Chrome `42021367093` PASS and production-preview success), skip every completed case 002–016.
- Use only existing s01b-owner QA identity, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, protected single-case workflow on `main`, matching guarded Preview deploy first.
- Log in at mobile 390×844. Read real scoped billing options, require configured plan and baseline persisted selection, then send exactly five deliberately malformed POST requests to `/api/station/billing/select`: unsupported payment `bank_transfer`, forged `amountSatang`, malformed plan UUID, malformed JSON, and cross-origin request. None is a valid selection.
- Expected: 400 `invalid_plan_selection` (first three), 400 `invalid_json`, 403 `origin_forbidden`. Re-read scope after each rejection and require saved selection unchanged. No billing charges, no money movement, no Stripe, no valid POST, no client-side write. Unexpected HTTP 200 is FAIL and demands incident review, not success.
- PASS requires protected real Chromium 1/1 and no side effects. This does **not** prove valid plan save or real payment settlement; those need separate gated QA cases.
