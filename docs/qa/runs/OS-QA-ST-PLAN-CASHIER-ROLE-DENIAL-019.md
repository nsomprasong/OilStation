# OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019 — PASS

- [PR #181](https://github.com/nsomprasong/OilStation/pull/181) merged to `main` as `4a732655d828cacdbe70908813ffe0fc3fe444ac`.
- PR-head CI: **12/12 SUCCESS**. Matching guarded [Production Preview 42027584412](https://github.com/nsomprasong/OilStation/actions/runs/42027584412) **SUCCESS**.
- Protected [Chromium single-case run 42027584480](https://github.com/nsomprasong/OilStation/actions/runs/42027584480) **1 PASS (7.6s)**:
  `CASHIER_AUTH_AND_SCOPE_PASS`, `OWNER_PLAN_NAV_HIDDEN_PASS`,
  `SAME_SCOPE_CASHIER_BILLING_DENIED_PASS` HTTP 403
  with only `{error:'permission_denied'}`, and `NO_WRITES`.
- Existing synthetic `s01b-cashier` tested on mobile against its **own** station; protected owner navigation and SaaS plan GET denied. No Stripe, finance, credit, or HR mutation.
- Read-only role denial **does not** prove the separate plan selection POST route is protected; case 020 covers that next.
