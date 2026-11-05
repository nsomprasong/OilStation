# OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004 — one case for form guardrails

**Owner directive:** continue from completed OilStation QA ledger and never rerun previously passed pages/cases.

## Scope
- Actor: existing `s01b-owner`, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, mobile 390×844
- Only: Home → ลูกค้าบริษัท → **เปิดบัญชีบริษัท** form
- Browser:
  1. authenticate, verify exact s01b station scope with /api/me;
  2. select `new` task tab, confirm unique visible pane and creation form;
  3. submit completely empty form; browser must prevent request, identify invalid required fields;
  4. fill company name, malformed email; browser must block;
  5. valid dummy `qa-validation-only@qa.oilstation.invalid`, **12-digit tax ID**; client must show `เลขภาษีต้องมี 13 หลัก` and make no API call;
  6. clear tax ID and choose statement billing; close day 0 (<1) must fail native validation and not create a record;
  7. no JavaScript errors; no POST/PUT/PATCH/DELETE to OilStation API. Keep user-entered invalid form intact after each test.
- This is specifically a **negative validation test**, not an end-to-end account-creation test. Never click submit when all data are valid.

## Baseline, no writes
- Supabase production `cxihsotcpdnalswfoysx`: stations 5, companies 12, accounts 12, s01b links 3, wallet ledger 5, fuel sessions 2, audit 258, payroll/payouts 0.
- Prior case `OS-QA-ST-CUSTOMER-CREDIT-003` **PASS** via real Chromium [41988952559](https://github.com/nsomprasong/OilStation/actions/runs/41988952559). Do not replay.
- No bank, Stripe, email, real company create or invite, role changes, credit, fuel or payroll operations are authorized in this isolated case.

## Evidence and exit
One changed `e2e/qa.case-*.pw.mjs` file, run via existing GitHub `QA serialized next case only` workflow. Verify UI, no writes, SQL counts and record result under `docs/qa/runs/`. Any unintended POST = FAIL and must not be masked.
Full account creation and first-admin invitation need a **separate** approved QA write case with verified recovery and explicit cleanup manifest before go-live.
