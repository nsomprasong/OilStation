# OS-QA-ST-PLAN-CROSS-SCOPE-READ-018 — PASS

- [PR #180](https://github.com/nsomprasong/OilStation/pull/180) merged `17fff33f15a6d71672bfdb9e429823d927ba66f3`, CI 12/12 PASS.
- Matching guarded [Production Preview 42026668894](https://github.com/nsomprasong/OilStation/actions/runs/42026668894) SUCCESS.
- Protected [one-case Chromium 42026668944](https://github.com/nsomprasong/OilStation/actions/runs/42026668944) **1 PASS (10.1s)** with `AUTH_AND_SCOPE_PASS`, `OWN_STATION_READ_PASS`, `CROSS_SCOPE_READ_DENIED_PASS` HTTP 403 with `{error:'permission_denied'}` only, `UNAUTHENTICATED_DENIED_PASS` HTTP 401, and `NO_WRITES`.
- Actor `s01a-owner` scoped only to s01a, foreign data belongs to s01b. No billing POST, Stripe, HR or credit writes.
- PASS only for cross-station billing options GET isolation; does not establish member role denial, valid checkout selection, or payment settlement.
