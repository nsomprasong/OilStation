# OilStation — Superpowers production release assessment (2026-10-30)

**Status: NOT RELEASE-READY.** This is a verification snapshot, not an authorization to turn on money writes, payroll, or live coupon settling.

## Reproduced production issues (fixed in feature branch; NOT deployed)

1. **Invitation not emailed.** Cloudflare Worker has `RESEND_API_KEY` secret and `INVITATION_FROM_EMAIL=no-reply@oilstation.goldensoft.cloud`, but production `INVITATION_EMAIL_ENABLED=false`. The existing adapter writes an invitation and returns a manual link without calling Resend. The branch changes only production Wrangler config to `true`; UAT remains `false`.
2. **Cannot manage fuel.** Existing Worker preview allowlist excluded `GET /api/station-fuels` and `POST /api/station-fuel-config`. Both have existing bearer-auth, scoped-membership authorization and server-side SQL checks. The branch includes exactly these routes without enabling coupons, money transfers or payroll.
3. **Existing unsent invitation is not retroactively emailed.** Only a hash is stored server-side. A new invitation needs to be created after a reviewed email-enabled release; do not recover an old invitation by exposing its token or reuse screenshot URLs.

## Superpowers TDD checkpoints

- RED: commit `f4b30450955a6ad2322e897204a22c8b3e1b8395`, Checks run 41021546947 failed **two newly introduced tests as expected**, while Worker syntax and Vite build passed.
- GREEN: commit `630750e10d280766a3da4e60d363a2e6bcecf701`, Checks 41021662316 passed Worker syntax, Vite, all Node tests, production and isolated-UAT Wrangler dry-runs. The other seven isolated GitHub SQL integration workflows passed.
- Additional Worker→Supabase→Resend integration tests with a **fake network provider only** are included in the same branch. No actual deliverability proof is claimed.

## Read-only production checks

- Supabase project `cxihsotcpdnalswfoysx`, `public.oilstation_release_status()`: **`ready:false`**, schemaVersion `20261029215000`.
- 73 public tables; **zero** tables violating forced RLS or browser CRUD restrictions.
- Protected evidence and slip buckets exist and satisfy the release function's privacy checks.
- **The entire reviewed fuel settlement chain is missing in the live database**, not just the readiness marker: `fuel_supervisor_authorized`, `fuel_photo_review_inbox`, `review_fuel_evidence_photo` and `complete_reviewed_fuel_session` are absent, and both `fuel_evidence_intake` reviewed amount columns are absent. All are present as reviewed source migration `20261029192000_supervisor_fuel_settlement.sql` but have not been installed in Production. Existing finance routines cannot be taken as substitutes: true release requires independently reviewed photographic evidence and controlled settlement. Do not satisfy `/api/ready` by creating a stub.
- Current development data: **one station; one pending invitation; zero active station memberships** at assessment time.
- Worker at assessment time still has `OILSTATION_API_ENABLED=false`, `OILSTATION_PREVIEW_OPERATIONS_ENABLED=true`, `INVITATION_EMAIL_ENABLED=false`.

## Release blockers and required independent evidence

| Gate | Existing automated evidence | Not yet demonstrated |
|---|---|---|
| Auth and invitations | OAuth unit tests; signed invite email mock | Live Resend provider acceptance, inbox delivery/bounce status, real Google/Facebook invited-account sign-in including differing email, replay and tenant scope in isolated UAT |
| Station fuel | Station-price RBAC and SQL tests; branch route allowlist tests | One real owner setup, independent user permissions, station A/B isolation, private photo intake and **reviewed settlement** in release database |
| Coupon and payments | Simulated SQL concurrency/holds and Stripe sandbox code | Live network concurrency, pump/receipt evidence, actual Stripe sandbox success/refund and independent bank reconciliation |
| HR/Payroll | Isolated time/shift/payroll previews | Legally reviewed payroll, tax, withholding, PDPA biometrics consent/retention and actual bank export testing |
| Operations | Unit tests, Vite, Wrangler dry-runs | Backup-and-restore drill, monitoring/runbooks, real device/browser acceptance, production rollback verification |

**Do not mark the entire production service usable** simply because frontend and a limited preview succeed. An explicit go-live instruction from the owner does not turn failed technical acceptance checks into a PASS.

## Next controlled steps

1. Review this Draft PR; do not merge it to `main` until release is approved because main pushes trigger production preview deployment.
2. Build/verify `complete_reviewed_fuel_session` and its independent safety tests on an isolated environment, then apply reviewed migrations.
3. Complete external-provider, cross-tenant, real-device, backup and legal/payment gates.
4. Run the authorized deployment workflow, confirm `/api/ready=200`, inspect live delivery and tenant permissions; only then enable the complete production API.
