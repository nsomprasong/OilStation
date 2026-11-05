# OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019 — PASS

- [PR #181](https://github.com/nsomprasong/OilStation/pull/181) CI 12/12 PASS, merged `4a732655d828cacdbe70908813ffe0fc3fe444ac`.
- Matching guarded [Production Preview 42027584412](https://github.com/nsomprasong/OilStation/actions/runs/42027584412) SUCCESS.
- Protected [Chromium 42027584480](https://github.com/nsomprasong/OilStation/actions/runs/42027584480) **PASS 1/1 (7.6s)** with `CASHIER_AUTH_AND_SCOPE_PASS`, `OWNER_PLAN_NAV_HIDDEN_PASS`, `SAME_SCOPE_CASHIER_BILLING_DENIED_PASS` 403, `NO_WRITES`.
- QA s01b-cashier, same station as billing owner, cannot see Plan navigation or call owner-only `GET /api/station/billing/options`. Backend denied with `{error:'permission_denied'}` and no plan disclosure. No POST.
- Independent Supabase after run: memberships 100, audit_events 260, payroll_runs 0; unchanged.
- PASS for one cashier owner-only read/navigation access guard; not a valid checkout/Stripe settlement or all role permutations.
