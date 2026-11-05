# OS-QA-ST-PLAN-CASHIER-ROLE-DENIAL-019

- New case distinct from case 018 cross-station owner isolation. Use exactly existing `s01b-cashier` QA actor on mobile 390×844, same station s01b `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- Log in via protected QA login. Confirm API `/api/me` role is `cashier` and scope is station s01b. Confirm overview lacks a visible Plan owner management navigation tile; direct authenticated `GET /api/station/billing/options?stationId=s01b` must be **403 `permission_denied`** despite same station membership. Do not rerun the already-verified unauthenticated check from case 018.
- No billing POST, no write, no Stripe charge; normal owner access was covered by case 016 and shall not be repeated. If cashier sees a Plan admin tile or receives 200 options, FAIL and investigate permissions rather than recording PASS.
- One spec triggered by CI-gated main squash, matching guarded Production Preview + protected Chromium secret, no previous case repeats.
