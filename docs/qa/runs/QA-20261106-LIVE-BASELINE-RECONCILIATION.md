# QA live baseline reconciliation — 2026-11-06 (read-only)

Source: independently queried production Supabase `cxihsotcpdnalswfoysx` at current GitHub main `e266f0b64bb2c79186603a2acfd4c99b680d37f9`. All SQL was SELECT-only. This document **does not** assert new E2E passes, approve a financial release, or authorize deletion.

## Current database inventory

| Entity | Count | Scope/interpretation |
| --- | ---: | --- |
| `stations` | 5 | Four intended QA stations plus pre-existing station `ทดสอบ1` |
| `corporate_station_accounts` | 12 | QA corporate/station links |
| `fuel_sessions` | 2 | Both pre-existing `completed` sessions at QA-S01-A |
| `station_subscriptions` | 1 | Existing term; preserve |
| `station_plan_checkout_requests` | 1 | Preserve |
| `saas_invoices` | 1 | Historical invoice; preserve |
| `payroll_runs` | 0 | No payroll run found |

Four intended QA stations (all `active`): `QA-S01-A` (created 2026-10-31 08:39:55 UTC), `QA-S01-B` (08:41:24), `QA-S02-A` (08:53:31), `QA-S02-B` (10:01:34). The extra `ทดสอบ1` station was created on 2026-10-30 07:31:18 UTC. It must not silently become a fifth fixture or be deleted without a scoped manifest.

Two `completed` fuel sessions on QA-S01-A (`station_id=e22fb5ff-1878-446f-ab8d-585115e8a1a9`):
- `cc4ec9e8-77d8-4c45-953c-d1cec65ffd18` created 2026-11-01 04:49:41 UTC.
- `3fb06a09-d20a-468c-ac65-5c43e72883d0` created 2026-11-01 10:29:51 UTC.

## QA execution guard

1. Compare future baselines against **the same filtered four QA stations**; total `stations=5` is not a regression nor proof a fifth Sales station was created.
2. Distinguish historical completed fueling from newly executed photo-review / authorization / wallet-ledger acceptance. Two completed rows do **not** establish full protected S-06/S-07/S-08 acceptance.
3. Keep finance/HR release flags closed and preserve existing invoice, subscription, checkout request, and prior fuel-session rows. Do not mutate/delete/reset them for a positive test.
4. Master cases already completed must not be replayed; launch only unique, not-yet-proven cases after preflight, and require a reversible synthetic fixture and independent before/after SQL for any positive writes.
5. Issue #205 remains BLOCKED: positive plan change, effective date, module cutover, scheduler, idempotent paid activation and proration are not established by this SELECT-only reconciliation.
6. All entries above are current inventory, **not** evidence of this turn creating records. No new Chromium/Workflow run was launched in this reconciliation.

This corrects overbroad historical count comparisons (e.g. QA-specific four stations vs total five, or earlier fuel-session count zero) without changing the 236-case Master status crosswalk or reclassifying blocked tests.
