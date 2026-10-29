# OilStation release gate status — 2026-10-30

**Overall: DEVELOPMENT PROGRESS, NOT A RELEASE.** Current customer-facing
oilstation.goldensoft.cloud runs a separate maintenance placeholder.

| Gate | Verified evidence | Still required |
| --- | --- | --- |
| Internal Node tests | 225/225 PASS at ebe8cac6 | Real browser/device UAT |
| Isolated PostgreSQL | Fuel, Billing, HR Attendance, Topup, Cross Finance, OAuth OTP and 65-table migration parity PASS | Real isolated Supabase Auth/Storage, tenant data and DDL migrations |
| Frontend/Worker build | Vite and Wrangler dry-run PASS | Authorized, verified Worker deployment and rollback |
| Invitations | Token scope, OTP proof, optional outbound mail code tested | Verified sending domain/Resend secret; Google/Facebook OAuth live end-to-end; bounced mail |
| QR fueling | Atomic holds, photos and settlement transactions simulated | Actual pump device, OCR/photo, supervised exception and race/load tests |
| Corporate top-up | Private slip, manager review and debt-first SQL tested | Real bank confirmation/reconciliation with separate staff |
| Stripe billing | Test-mode intent, signed webhook and lock-order tests simulated | Actual Stripe sandbox payment and refund, legal VAT review, group-billing UAT |
| HR/Payroll | Shift, GPS review and payable=false previews tested | Thailand legal, PDPA/biometrics, withholding/social security, real payroll bank exports |
| Compliance/release | RLS/grants and static threat gates audited | Backup/restore drill, operational controls, legal approval and explicit production release |
| Staging | 65-table metadata-shaped disposable PostgreSQL passed | Supabase branch **cost approval required**; no billed branch created |

## Explicit approvals / configurations outside repository

1. **Supabase staging branch:** the provider requires an approved hourly branch
   cost before creation. No cost has been approved or charged by this workflow.
2. **Google/Facebook OAuth:** configure approved client credentials and redirect
   URIs in the selected Supabase project and identity providers.
3. **Invitation sender:** verify sender ownership/SPF/DKIM and put
   INVITATION_EMAIL_ENABLED, INVITATION_FROM_EMAIL and RESEND_API_KEY into
   encrypted Cloudflare Worker settings. Keep email sending disabled until verified.
4. **Stripe and bank:** create isolated test-mode credentials, dedicated test
   account, and separate people for evidence review. Do not enable live charges.
5. **Thai payroll/PDPA:** qualified legal/payment review before calculating
   salaries, withholding taxes or collecting biometric templates.

No production merge, migrations, Worker deploy, bank payment or real mail has
occurred in this continuation. The developer has not claimed a finished release.


## Further gates added — refund safety and organization HR

- The Stripe Worker does not acknowledge unsupported signed
  refunds/disputes/cancellations as reconciled. Such events remain in the
  signed test inbox and receive HTTP 503 until an audited financial recovery
  handler is added. **No real refund/chargeback reconciliation yet.**
- Organization owners can manage their own station shift creation and
  scheduling through role-checked database RPCs, with regression coverage
  proving another organization's staff and templates remain inaccessible.
  Work remains to expose a complete owner-facing multi-station HR selector.
- Full-schema sequential migration count is now 27 unapplied developer SQL
  files; production applied migration count remains 30.
- EIGHT isolated GitHub Action workflows, 225 Node tests, frontend build and
  Wrangler dry run PASS at ebe8cac6. External test accounts and approved
  Supabase staging are still required before an end-user test.

