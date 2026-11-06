# PKG-CHG-01 — previously unexecuted positive read-only current SaaS term

Tests live QA-S01-A trialing existing `station_subscriptions` with term Nov 1 to Dec 1 UTC and current monthly plan, actual on-screen Thai rendered term, disabled legacy Save, future-date unsupported POST 400 before SQL, foreign QA-S01-B owner denied 403, before/after unchanged owner snapshot. Protected single QA case; no duplicate historical 001–158 tests.

**Does NOT count PKG-CHG-02+ or Full Production as PASS**. Existing positive upgrade/downgrade, explicit next effective date, payment, proration, idempotent activation and module entitlement switches still blocked under #205. Requires 12/12 PR CI, SHA-matched Preview, 1/1 protected Chromium and independent 12-counter live SQL invariance.
