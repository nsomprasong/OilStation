# OilStation Sales / Platform UX and deployment acceptance — 2026-10-31

## Roles / visibility
- Platform Super Admin sees Sales list, pending invitation emails, station choice, transfer form, all current/upcoming/history assignment cards, verified paid-customer list, commission ledger/entitlement reporting.
- Platform Sales sees only their own assignments, collected-customer attribution, and accrued/ledger commission records. They cannot see other sales staff or transfer ownership.
- Platform Support and station staff do not receive the Sales screen.
- Invite Sales uses the existing `platform_sales` token + secure scoped invitation flow. A returned accepted-by-provider message is NOT proof of actual email delivery; email delivery and sign-in must be verified manually.

## Human journeys
1. Platform Home contains every allowed destination and the one Sales entry (no repeated full nav).
2. Inside Platform Stations / Sales, the top menu shows only related task links, never unrelated modules.
3. On mobile the bottom nav contains Home, Work, Scan, and History — there is NO hamburger. Non-pinned services are available from Home.
4. Admin sends invitation to a salesperson; copy invite URL if email delivery is not confirmed.
5. Invited salesperson completes OAuth and invitation acceptance; sees only Home + their own Sales workspace.
6. Admin selects station, active salesperson and reason. Server schedules for next midnight in station timezone. Visible transfer is NOT immediate.
7. Transfer history retains prior salesperson. Second pending transfer is rejected rather than silently replacing an already scheduled one.
8. Salesperson opens their workspace and sees only own current/upcoming station cards and historic assignments.
9. Paid-customer report includes only a paid invoice and a linked commission entitlement for that same salesperson and station.
10. Commission panel distinguishes entitlement totals and ledger entries from actual payout; transfer does not rewrite entitlement or ledger records.
11. Empty states make zero assigned accounts and zero earned commissions explicit instead of showing placeholder earnings.
12. Sign out remains available using Home power on mobile or toolbar on desktop.

## Code and data validation
- CI Node tests, Vite build, Wrangler checks, and isolated Postgres schema suites on exact branch head must pass.
- New `platform_sales_workspace` and `platform_transfer_sales_station` RPCs are callable by service_role only; SQL verifies current platform roles independently from the Worker.
- Cross-origin, overlong body, invalid UUID, extra fields and insufficient reason are rejected at Worker layer.
- SQL locks the station row on transfer and records an audit event with prior/new sales and reason.
- No migrations can promise existing customer data, real payment, commission payout or email provider delivery; these need live role-based UAT.
- Deploy procedure: apply only the reviewed migration; verify both RPC ACLs and no data mutated; merge the reviewed PR to main; check Production Preview deploy + /api/health and /api/ready negative financial gate; verify live Cloudflare OILSTATION_API_ENABLED remains false; then human tests.
