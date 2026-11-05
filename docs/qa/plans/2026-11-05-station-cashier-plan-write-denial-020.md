# OS-QA-ST-PLAN-CASHIER-WRITE-DENIAL-020

- This is the **single next never-run case**. Previous 002–019 successes are not repeated.
- Existing synthetic actor `s01b-cashier`, mobile viewport 390×844, station s01b. Validate independent `/api/me` scope and `cashier` role.
- Use existing `s01b-owner` only to read `GET /api/station/billing/options` immediately before and after. The baseline and final `selected` must match byte-for-byte in the parsed payload.
- Cashier makes exactly ONE authenticated `POST /api/station/billing/select`, same own station, properly structured body, valid payment method, but intentionally nonexistent syntactically valid plan UUID `00000000-0000-4000-8000-000000000020`. It is not a purchasable plan. Permission must be checked first and return **HTTP 403 `{error:'permission_denied'}`**, with zero pricing data leaked. If authorization regresses, invalid plan pricing is designed to stop checkout persistence instead of charging money.
- Unlike 019 this checks the write endpoint, not GET or navigation. Unlike 017 this checks *role authorization* with a structurally valid body, not invalid payload validation.
- No real plan selection, Stripe call, settlement, payroll, credit action, accepted writes, or rerun of existing successful cases.
- Guarded Production Preview of exact merge SHA must pass before the protected serialized Chromium test. Failure/blocker must remain explicit. Do not unlock full Production on this case.
