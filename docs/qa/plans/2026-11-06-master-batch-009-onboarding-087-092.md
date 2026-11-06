# OilStation — Master TEST-6-009: six new role-based onboarding and idempotency cases

**2026-11-06**. Six never-run Master cases, newly numbered **087–092**, one PR, one guarded Production Preview deploy at matching SHA, serial protected Chromium. No full finance release or payroll enablement; no staging.

| QA | Master ID | Role | Bounded real acceptance |
|---|---|---|---|
| 087 | P-01-H | sales01, sales02, s02b-owner | Three QA credential logins with verified real /api/me memberships; correct Home menu and five-slot responsive bottom navigation; no wrong-role screens. **Not Google OAuth or Super Admin/Support login** (no support01 QA account in fixture). |
| 088 | P-02-V | sales01 + sales02 | Two existing Sales each already own two QA stations: well-formed attempt for third (valid active PTT brand + true QR module) gets 409 `sales_station_limit_reached`; own 2-station inventory unchanged. Verified SQL `platform_sales_create_station` uses actor-specific advisory transaction lock and applies QA max=2 **before any station/org INSERT**. |
| 089 | P-02-F | sales02 | Browser aborts first submit at network edge before server receives it. User-visible network error, second click reuses exact same request ID, server denies third station 409, no fifth station. Synthetic/no money transactions. |
| 090 | P-03-H | sales01 + s01a-owner | Active PTT brand appears in authorized station draft with QR enabled default and HR off; existing station A has 10 real brand fuels, 8 disabled/unpriced staging rows + 2 active. **Does not create a new station**. |
| 091 | P-10-V | sales01 | Replay prior existing request ID for QA-S01-A *twice* returns 200 and same station with `replayed=true` and ten staged fuels; own 2 stations unchanged. Separately covered third-station 409 in 088. |
| 092 | S-02-H | s02b-owner | Existing station owner can open authorized staff-invite UI with 6 approved roles, focus and close; no station_owner / platform_superadmin / corporate_admin; **no invitation submitted**. |

## Read-only production DB baseline before run

`QA stations 4; organizations 5; Sales station creation requests 4 (2 per Sales); audit events 260; corporate station accounts 12; station fuel rows 40; payroll runs 0; SaaS checkout requests 1`. Existing S01-A has 10 fuel rows with 8 disabled/unpriced, 2 active. Compare exact after browser run.

## Security and coverage limitations

- Browser tests use existing synthetic users, validate precise actual /api/me role+scope. No creation of additional users/stations/customers/credits/invoices, no payment or payroll writes.
- Third-station POST 409 and idempotent replay 200 are safe **because** the current audited SQL checks quota/known request IDs before any INSERT; independent production row counts required after. Browser network abort happens before the API receives the first POST.
- Never rerun previous successful cases 039–086.
- **P-04-H and P-04-V remain unexecuted in the pending queue**, because QA-S02-B HR module is disabled and full entitlement/module enforcement requires a dedicated release-safe test. The bundled scope does not prove purchase/disabled feature gates. Google OAuth flow and newly created station behavior also remain pending.
- Report PASS only after PR CI 12/12, matching Guarded Preview, full serial Chrome 6/6, and independent identical Supabase counts.

**Pre-run state:** NOT EXECUTED.
