# OS-QA-ST-INVITE-VALIDATION-006 — station invitation negative input workflow

Owner requirement: continue sequentially one task, one actor, no repeat of completed cases 001–005.

## One isolated UI case
- Account: existing `s01b-owner` only; station `76388e2c-ef36-4656-808b-7d0fbd1d2c35` only.
- Phone viewport 390×844; Home → เชิญสมาชิก → เพิ่มสมาชิก → เชิญด้วยอีเมล.
- Verify drawer is visible and role choices are only the six station staff roles (owner escalation must not be offered).
- Test **native invalid-input handling** for blank and malformed recipient email only, and close drawer.
- Absolutely **no POST** to `/api/invitations/create` or any other business API; no actual invite, no email, no QA actor created or modified.
- Login via protected GitHub Environment secret. Assert /api/me exact station owner scope and no browser exceptions.
- If inaccessible/blocked, report failure honestly; do not weaken Worker or RLS.
- Run through `QA serialized next case only` after matching guarded Preview deploy; do not rerun case 005, 004, 98-role, Platform or Corporate batches.
- PASS proves only validation/drawer UI. Positive invite delivery/acceptance and role enforcement require a separate bounded authorized write-and-cleanup test.
