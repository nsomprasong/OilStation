# OilStation scoped credit, reports and employee management release plan (2026-11-04)
Owner authorized code changes on existing OilStation production. Current read-only baseline: 12 station accounts, 2 fuel sessions, 3 HR employees, 100 memberships. Preserve all ledger, coupons, attendance, payroll and audit history.

**Financial guard:** Credit totals are read-only calculations from corporate_station_accounts. No direct balance writes; real top-up remains company slip upload followed by verified station bank approval. No real transfer or QA ledger writes are permitted during tests.

**Permissions:** Station account summaries and fuel reports are station-scoped; corporate reports limited to the actor's company. Member directory is station/corporate admin-scoped. Role edits whitelisted; deactivate only a non-owner, non-admin, non-self membership and preserve account/history, block drivers with active coupons. HR employee deletion is status change with future-shift check, never deletes payroll.

**SQL release:** Forward-only RPC migration, execute only service_role, revoke anon/authenticated/PUBLIC. Run isolated SQL migration tests, npm check/tests, Playwright at 320/390/1024/1440, merge CI, production deploy, verify RPC ACL, Cloudflare flags and counts after deploy. Authenticated production workflows not marked PASS unless executed with verified role.

**No reset:** no fixtures, financial transactions or destructive database cleanup authorized by this implementation request.
