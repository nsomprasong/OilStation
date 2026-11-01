# OilStation — isolated Stripe TEST UAT activation (1 Nov 2026)

## Current status (DO NOT treat as enabled)

- Production Supabase ref: `cxihsotcpdnalswfoysx`. Never run refund/dispute SQL migrations or destructive QA against it.
- Current `oilstation-uat` Worker intentionally points to the **shared** production-backed database, with `OILSTATION_API_ENABLED=false` and an immutable, fixed Stripe paid-invoice pilot. **Do not enable refund/dispute on this Worker.**
- The refund/dispute SQL and domain checks were exercised in disposable PostgreSQL CI. A real Stripe test-mode refund and automatic card renewal have **not yet been proven**.
- An independent Supabase UAT branch or project requires separate pricing approval, its own endpoint and keys. A Supabase branch must never be merged to the production branch automatically.

## Preflight: independent database and safe Worker cutover

1. Obtain approval for Supabase branch/project usage charges from the owner, then create one in the OilStation organization in Singapore (`ap-southeast-1`). Record its **new** 20-char Supabase ref.
2. Deploy the forward-only baseline OilStation schema to that independent database, then deploy migration files `20261101171000_saas_test_refund_journal.sql` and `20261101183000_saas_test_dispute_review_history.sql` in order. Apply migrations to **UAT ref only**, not the shared production project.
3. Confirm `oilstation_release_status()` on isolated UAT returns ready with the expected schema version; review security advisories/RLS and check `saas_test_refund_journal`, `saas_test_dispute_review_events` exist. No copy of customer/station/employee production rows; seed fictitious users, station(s), group and invoices in UAT only.
4. Create or select a **separate UAT Worker name** for isolated billing. Do not repoint the existing `oilstation-uat` shared QA pilot until its immutable paid-invoice controls and prior webhook have been retired. Cloudflare secrets must belong to the new UAT Supabase ref.
5. Set the following UAT-only bindings; do not commit private keys:
   - `OILSTATION_DEPLOY_TARGET=uat`, `OILSTATION_UAT_SUPABASE_REF=<new UAT ref>`, `SUPABASE_URL=https://<new UAT ref>.supabase.co`
   - `OILSTATION_SHARED_QA_BILLING_ENABLED=false` (must not share production-backed pilot)
   - `OILSTATION_API_ENABLED=true` **only after** migration, release readiness and test scope verification
   - `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: separate UAT keys; service key is a Worker secret
   - `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_PUBLISHABLE_KEY=pk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` for a **new, isolated Stripe TEST webhook destination**
   - `STRIPE_TEST_PAYMENTS_ENABLED=true`, `STRIPE_TEST_RECONCILIATION_ENABLED=true`
   - Initially leave `STRIPE_TEST_REFUNDS_ENABLED=false` and `STRIPE_TEST_DISPUTE_REVIEW_ENABLED=false`
6. Verify all new refund/dispute opt-in checks fail on both Production and the shared-project pilot using `test/security/stripe-isolated-uat-gate.test.mjs`. Do not repoint `oilstation.goldensoft.cloud`.

## Test acceptance (only after isolation is verified)

- Stripe test PaymentIntent charged through the isolated UAT checkout; confirm signed `payment_intent.succeeded`, one invoice `paid`, one payment attempt, and one processed event. Record test fixture IDs.
- Turn on `STRIPE_TEST_REFUNDS_ENABLED=true` **only on isolated UAT**. Subscribe its distinct Stripe TEST webhook destination to `refund.created`, `refund.updated`. Create partial and remaining TEST refunds via Stripe test tools (never production credentials). Verify ledger totals, full refund transitions, and duplicate/out-of-order events never double-post.
- Turn on `STRIPE_TEST_DISPUTE_REVIEW_ENABLED=true` **only on isolated UAT**. Subscribe to `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Audit Dispute history out of order and duplicates. Dispute review remains **read-only**; an actual chargeback/payout reversal needs a separate approved financial reconciliation and cannot be inferred solely from events.
- Test a second monthly invoice for a five-station group. Automatic renewal **does not exist merely because a monthly card invoice can be issued**: separately test stored payment-method consent, off-session authorization, failed recurring charge, cancellation, idempotency and notification.
- Verify wrong currency/amount/payment intent, live event, bad HMAC signature, unrelated customer and expired event fail closed. No wallet or commission postings from Stripe SaaS payment/refund. Do not mix QA fixtures with live tenants.

## Revert / shutdown

- Disable `STRIPE_TEST_REFUNDS_ENABLED`, `STRIPE_TEST_DISPUTE_REVIEW_ENABLED`, `STRIPE_TEST_RECONCILIATION_ENABLED` on isolated UAT, then remove its Stripe webhook subscriptions/endpoint.
- Confirm source Production invoices, paid attempts and `stripe_events` counts unchanged. Never reset the previously settled shared-project QA PaymentIntent.
- Delete/stop the isolated Supabase branch when UAT is complete to avoid continued compute charges. **Do not delete the Production project.**

**Status:** UAT activation remains blocked until the owner approves the separately billed Supabase branch/project and the independent endpoint and secret bindings are confirmed.
