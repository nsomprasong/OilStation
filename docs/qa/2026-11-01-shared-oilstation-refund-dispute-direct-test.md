# OilStation — Shared project Stripe TEST QA (Nov 1, 2026)

## Owner-approved target

- Owner chose to test against the **existing** Supabase OilStation project `cxihsotcpdnalswfoysx`, not to purchase a new branch/project.
- QA scope is the frozen test organization `QA-ORG-S01-A`, station `QA-S01-A`, and the fixed run `QA-20261031-PLATFORM-001`.
- The previously confirmed Stripe TEST PaymentIntent `pi_3UWu3JGYSd2MkyFd2sC3ubZi` was read-only verified as `succeeded` for **342400 satang (THB 3,424)**. Original test invoice `af6bd702-eecb-45da-b031-3039baaaca32` remained `paid`, payment attempt `succeeded`, and its signed event `processed`. **Do not refund or recharge this original payment.**

## Actions completed directly in Supabase

- Applied one atomic shared-project SQL-only migration named `shared_qa_refund_dispute_sql_only_locked_20261101` containing the two reviewed QA tables and refund/dispute processor functions from:
  - `20261101171000_saas_test_refund_journal.sql`
  - `20261101183000_saas_test_dispute_review_history.sql`
- The shared-project deployment **deliberately removed** the final `GRANT EXECUTE ... TO service_role` from both functions. Production code and the shared QA Worker **cannot invoke refund or dispute accounting processors**.
- Both new journal tables have RLS enabled and FORCED, with zero public row policies. Confirmed no rows in either new table.
- Read-only scope probes: QA invoice + QA run + QA station -> **true**; wrong run -> **false**; wrong station -> **false**.
- Verified both privileged refund/dispute functions have `has_function_privilege('service_role', ..., 'EXECUTE')=false`; authenticated users cannot invoke the refund processor.
- Verified after migration: 1 invoice (paid), 1 payment attempt (succeeded), 1 processed Stripe event, 0 refund journal entries, 0 dispute entries.

## Limitations and next review

- Attempt to run a mutating Refund/Dispute SQL regression with explicit `BEGIN / ROLLBACK` **was blocked by the execution tool's safety controls**. No simulated refund/dispute mutation was run against the shared Supabase project. Do not report this as a successful live-database financial test.
- The same full logic, refund replay, over-refund, order inversion, and dispute immutability remain covered by **disposable PostgreSQL GitHub CI**, not an actual Stripe refund execution.
- No new charge, refund, dispute, or webhook subscription was created on Stripe. No real funds affected.
- The SQL-only migration name in hosted Supabase differs from the two source migration filenames because they were deliberately installed atomically with the final service-role lockdown. Source migrations are now idempotent and default-deny; future schema deploys must review the hosted migration list, avoid duplicate table creation and never regrant service-role execution without a separate authorized QA scope and validation.

## Safe next step

1. Keep current paid invoice immutable and existing shared-project test Stripe routes limited to `payment_intent.succeeded` with QA attestation.
2. Only if full provider E2E is needed: create **a NEW and separately labeled QA invoice** under an authorized QA group, attach a fresh Stripe TEST intent and verify the webhook signature; do not use the earlier settled invoice.
3. Require additional per-invoice SQL attestation and a one-off narrowly scoped test-only handler before granting any refund/dispute processor privilege. Keep general financial API and automated renewals disabled.
4. Repeat read-only verification after any changes.

**No separate Supabase billing resource was created.**
