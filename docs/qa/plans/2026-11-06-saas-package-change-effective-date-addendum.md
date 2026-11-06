# OilStation — UAT addendum: SaaS package change + effective start date

**2026-11-06 — Issue [#205](https://github.com/nsomprasong/OilStation/issues/205).** Additional acceptance coverage requested by owner. **Do not increase the canonical 236-scenario count** or conflate with already passed initial plan quote tests.

## Actual state found on production database and deployed API

| Component | Verified behavior | UAT impact |
|---|---|---|
| `public.station_subscriptions` | `plan_id`, `starts_at`, `current_period_end`, `status` persisted; one QA-S01-A trialing subscription 2026-11-01T00:00:00Z through 2026-12-01T00:00:00Z | Current term is readable independently in SQL |
| `public.station_select_saas_plan` | Throws `INVALID_REQUEST` for any station with `trialing/active/grace/overdue` subscription, **before any checkout write** | Positive switch of active subscription is **not yet implemented** |
| `POST /api/station/billing/select` | Accepts **only** `stationId`, `planId`, `paymentMethod` | `startsAt`, `effectiveOn`, `newPlanStartsAt` are invalid 400; no future effective date scheduling API |
| `public.station_plan_checkout_requests` | Upsert pending initial selection per station with no requested start date | Cannot represent queued transition or rollback |
| `platform_subscribe_saas_station` | Accepts `startsAt` and `periodEnd` for initial subscription only; rejects existing open subscription | Must not be used as a hidden shortcut to overwrite/change paid subscriptions |
| Station owner Plan UI | Select current plan and card/PromptPay quote; no effective date field or active→future transition status | Need new display, scheduling flow and audit history before release |

**Immutable live QA baseline:** 1 trialing station subscription; 1 checkout intent; 3 pricing plans; 1 paid historical invoice. Never alter these fixtures to manufacture a positive change, and never mark release gate PASS from a failed unsafe attempt.

## Required acceptance cases — separate supplemental PKG cases

| ID | Scenario | Expected observable result | Current outcome |
|---|---|---|---|
| PKG-01 | Initial monthly/yearly and bundle quote | Correct active plans and satang/VAT/PromptPay amounts | PARTIAL/READ-ONLY: existing plan quote checks |
| PKG-02 | Existing active/trialing owner requests different plan | Authorized scheduled replacement, old plan remains until start | **BLOCKED: currently HTTP 409** |
| PKG-03 | Explicit replacement plan `startsAt` | Saved requested start date visible in UI and DB | **BLOCKED: current API rejects field (HTTP 400)** |
| PKG-04 | New package begins at old package `current_period_end` | Exactly one change at boundary, zero gap/overlap | BLOCKED: no transition scheduler |
| PKG-05 | Owner selects future start date | Valid station-local calendar and UTC timestamp round trip, no silent shift | BLOCKED: no date input/scheduler |
| PKG-06 | Immediate mid-cycle switch | Explicit policy for proration/unused credit/refund before confirmation | BLOCKED: policy and safe fixture needed |
| PKG-07 | Yearly→monthly downgrade or monthly→yearly upgrade | Annual prepay term protected; no premium access before date | BLOCKED |
| PKG-08 | Different module bundle QR/HR | New module entitlement only when scheduled change takes effect | BLOCKED |
| PKG-09 | Past date, nonexistent plan, missing/invalid date | 400/409; no mutation, appropriate localized explanation | NEGATIVE PARTIAL: missing/unknown date and unknown plan checks |
| PKG-10 | Duplicate request and concurrent change | Idempotent one scheduled change; no second charge or duplicate invoice | BLOCKED |
| PKG-11 | Cancel/reschedule pending change | Authorized audit trail and old plan intact | BLOCKED |
| PKG-12 | Wrong station, non-owner, old invoice mutation | 403 + no history data leak or amendment | NEGATIVE PARTIAL: role read/write tests; invoice immutable requirement pending |
| PKG-13 | Payment declined, restart, job retry | No early activation, deterministic recovery | BLOCKED |
| PKG-14 | Effective date near midnight, leap day, timezone | Station timezone and date shown clearly; no off-by-one day | BLOCKED (requires new scheduled timestamp) |

## Execution order and release rules

1. **Safe live negative assertions in Batch 010:** use existing QA-S01-A trialing membership to request a *different valid plan*, expect **409** and verify checkout/term snapshots unchanged. Send `startsAt` to the current endpoint, expect **400**, verify no write. These are PASS for *security/fail-closed*, and **explicit BLOCKED for successful switching and effective-date save**.
2. **Pure API regression checks:** exact request schema currently must reject silently ignored `startsAt`; permission and quote before/after. Unit tests **cannot substitute** for positive browser+DB transition proof.
3. **Feature implementation (separate reviewed PR):** introduce versioned `station_subscription_change_requests`/event history, owner scheduling form, explicit station-local effective date, mutually exclusive transition states, authorization, idempotency, and activation reconciliation; keep current subscription authoritative until actual transition.
4. **Positive integration UAT:** approved **reversible synthetic-only** fixture; simulate old plan, schedule, activation instant, duplicate retries, invoice/discount/proration, rejections, historical statements, user-visible confirmation; independent DB snapshots before/after.
5. **Release gate:** only PKG-02..08 & 10..14 real evidence may clear package change UAT. Never set Full Production until payment, HR/payroll and other master gates also pass.

**Effective-date policy pending product decision:** ordinary default may be next billing boundary, with optional future custom date if permitted. The system must show the chosen station-local date and an unambiguous UTC activation timestamp; **do not assume a proration/refund algorithm** merely to greenlight tests. Historical invoices are immutable.
