# Release blocker diagnosis, 2026-11-06 — QA after Batch 020

## Verified progress
Master UAT Batch 017–019 had protected Chromium 6/6 each. Batch 020 had 5/6 on initial run, and narrowly retried the failed-only X-07-H/158 to 1/1. All 24 had bounded PASS. These are **not** equivalent to positive finance or payroll release acceptance. Frozen QA production baseline: 4 stations, 12 corporate accounts, 12 drivers and vehicles, 2 completed fuel sessions, 2 coupons, 1 station subscription, 1 SaaS invoice, 1 plan checkout intent, 0 payroll runs.

## Unfinished Master test queue, **not passed**
| Batch | Master IDs | Real blockers / missing acceptance |
|---|---|---|
| 021 | S-06-R, S-07-R, S-06-V, S-17-R, S-20-V, S-05-R | Private cross-station photo and fuel completion negative cases; blurred plate manual review; employee self-approval; negative/duplicate payroll; cross-company wallet reserve. Read-only route access and isolated integration tests do not prove successful fuel or payroll writes. |
| 022 | S-10-V, S-09-F, S-17-F, C-05-V, P-06-H, S-18-R | Link expiry/pending, duplicate corporate creation, retroactive attendance audit, payment quotes and forbidden cross-station GPS. Positive state changes require safe bounded QA fixture with owner/station authorization. |
| 023 | P-09-F, S-04-H, S-08-R, S-12-R, P-10-F, S-10-R | Role removal/reinstatement, actual signed QR, cashier supervisor override, private evidence isolation, idempotent network retry, wrong-company link approver. Real QR settlement and account mutation are still gated. |
| 024 | C-05-R, S-04-F, X-09-H, S-16-V, S-19-R, S-19-F | Wrong-company link approval; manual camera fallback and exactly-once fuel charge; explicit QA cleanup; overlapping shifts, own OT approval, payroll reversal. Requires non-destructive positive workflows and reversible fixture. |
| HOLD-6-001–013 | 76 remaining originally HELD cases | Fully positive finance, HR, SaaS, Stripe, invoice or scheduled business mutation cannot be truthfully PASS from HTTP 403/503 or static-code inspection. |
| SPEC-6-001 | 4 obsolete/spec-review cases | Require updated acceptance before they can be counted. |

## Package switching and effective start date: Issue #205
Current station selection *cannot* switch a station with a `trialing/active/grace/overdue` subscription. The station `/api/station/billing/select` schema contains only `stationId, planId, paymentMethod`, and the checkout table cannot save future start dates or audit transition history. This change validates strict Gregorian dates in the **initial platform subscription** route and adds tests proving that invalid replacement dates fail closed. This is a security/validation improvement only, **not** a scheduled-switch implementation or positive acceptance.

Implement before release: stored transition intent and effective date/time zone; next-term transition policy and upgrades/downgrades; immutable prior invoice; idempotency; cancellation/rescheduling; Stripe test-mode or QR payment approval; scheduler/atomic activation; correct QR/HR module entitlement at the boundary; scenario-level rollback/cleanup on an isolated reversible fixture; positive Chromium and SQL verification. Until then #205 remains open.

## Execution requirements
No QA password in repository or logs. No blanket `OILSTATION_API_ENABLED=true` to pass tests against shared production data. No reset of the 4 stations / 12 companies. Respect 6-case batches, no already-pass replay, and independently verify live counters before/after. Do not declare Full Production based on CI, unit tests, or blocked-route behavior.
