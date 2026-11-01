# QA-20261101-HR-PAYEE-ADVANCE-001

Target production project cxihsotcpdnalswfoysx, OilStation main branch, same Cloudflare Worker. Four existing QA stations, twelve fictional corporate accounts. No staging database.

Owner-approved behavior: station manager records PromptPay phone/national ID or a manual bank account for employees without PromptPay; an independent manager approves the payee after checking actual recipient name. All identifiers go into Supabase Vault, never plain app tables, traces or log output. Masked account details are shown by default. PromptPay QR is a **payment instruction only**, never settlement evidence. Bank-only users receive manual bank-transfer instructions; no fabricated bank QR. Bank payments require independent external confirmation before recording paid; this PR does not implement real settlement.

Advance request: employee or authorized station manager selects amount, number of installments (1–24), first deduction date and employee payroll frequency. Approval by a different actor; requests/approval do not deduct wages; any actual deduction only after a separately verified disbursement and legally approved caps. Display installment preview; do not write payroll lines. Repeated actions fail closed. No automatic actual salary payments.

Tests: QR TLV/CRC vectors; invalid phone/ID, zero/negative amount; monthly/weekly/semi-monthly boundary dates, remainder allocation; installment first-date selection; per-role wrong-station denial, no self approval, approved payee only for QR, duplicate guard, safe masked listing; repeatable isolated SQL and Node/API tests. Browser smoke only with fixed QA actors and account identifiers that cannot be mistaken for a real payout. Verify Cloudflare Worker remains OILSTATION_API_ENABLED=false; guarded QA enable timeboxed & disarm on every result. Never create real PromptPay payment, bank transfer or paid payroll entry in QA.

Release criteria: check CI; review security permissions/RLS; apply migration to production only after its safe tests pass, verify schema, merge then guarded production-preview deploy; never imply auto-payment or real bank linking is complete.
