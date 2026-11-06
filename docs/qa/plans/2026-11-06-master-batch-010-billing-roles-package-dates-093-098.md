# OilStation — Master TEST-6-010 (093–098) and package effective-date addendum

**2026-11-06** · [Package-change UAT gate #205](https://github.com/nsomprasong/OilStation/issues/205) · [Complete change/effective-date matrix](./2026-11-06-saas-package-change-effective-date-addendum.md).

One PR/one guarded exact-SHA Preview/serial six-case Chromium. No rerun of 039–092; selected existing Master IDs are distinct and remain bounded to assertions actually run.

| Case | Master | Actor | What is actually checked |
|---|---|---|---|
| 093 | P-05-H | s01a-owner | Monthly & yearly live quotes; actual `trialing` subscription's attempt to select a different valid plan denied **409**; supplying replacement `startsAt` field denied **400**; selected checkout unchanged. **Successful change + new start date remain BLOCKED** |
| 094 | P-07-R | o01-billing | Organization's single paid invoice visible; other organization's invoice denied 403; own repeated GET equal |
| 095 | P-13-R | sales01 | Own Sales station inspection 200; other Sales02 station inspection 403, repeated denial consistent |
| 096 | P-15-R | sales02 | Sales cannot retrieve Admin QA scopes or reset a different Sales QA password (403), no mutation |
| 097 | S-11-V | s01b-owner | Invalid QA company term/day/credit input rejected 400 and same three accounts remain. **Real credit limit below outstanding still untested** |
| 098 | S-22-F | sales02 | Unsaved station draft name/brand/HR checkbox persists on session reload, no creation POST. Draft remains session-only and cleared on successful submit/logout |

### Additional release-safety regressions in same PR

- `src/api/platform-billing.mjs`: prevent `Date.parse` from silently normalizing nonexistent subscription start/end calendar days (e.g., **2026-02-30**). Preserve valid leap day **2028-02-29**, UTC and milliseconds. Unit regressions require zero DB calls on invalid dates.
- Existing owner plan-select route currently has **no** scheduled switch parameter. Unit tests assert `startsAt/effectiveOn/newPlanStartsAt` extra fields are rejected before any DB call, while an active-subscription conflict returns 409; neither constitutes a successful switch.
- The separate Issue #205 matrix explicitly covers next-cycle and future effective dates, mid-cycle upgrade/downgrade, old-plan expiry at exact boundary, timezone, entitlement start, reversal/proration, retries, cancellation and invoice immutability. **Do not greenlight positive change without a reversible QA-only fixture and implemented scheduler**.

### Immutable live QA preflight

Production Supabase read-only: **subscriptions 1**, **checkout_requests 1**, **pricing_plans 3**, **pricing_rules 8**, **saas_invoices 1**, **corporate station accounts 12**, **audit 260**, **Sales creation requests 4**, **payroll 0**, **invitations 2**. The sole QA-S01-A subscription is `trialing` for 2026-11-01T00:00:00Z to 2026-12-01T00:00:00Z.

Require after Chromium identical counts, same existing subscription `plan_id`, `starts_at` and `current_period_end`, and same checkout plan/amount. **No real Stripe/bank/Payroll/plan activation writes**.

**Status before running:** no browser PASS claimed. Required PR CI 12/12, exact-SHA guarded Preview, protected Chromium 6 cases PASS or accurately report failed cases. Positive package change release gate remains blocked regardless of a successful negative test.
