# QA Master S-06-R: scoped read-only plate evidence bridge — 2026-11-06

Release finance remains OFF. Previously `/api/evidence/plate/photo` and status were unavailable in guarded Production Preview even for read-only permission checks. Safely expose only GET `/api/evidence/plate/reviews`, GET `/api/evidence/plate/photo`, GET `/api/evidence/plate/status` to synthetic QA identities with exactly 4 permitted station IDs and 12 companies, with each private-object access independently authorized by existing Supabase role/tenant RPC. Unknown actors or foreign station identities receive HTTP403; QA mode disabled fails 404. Private bytes are not fetched before DB authorization; photo responses include CSP sandbox/no-store. **The QR, plate upload and review POST, fuel start/finish, credit reserve and payroll writes remain blocked when finance flag false**.

Unit regression validates cross-station, own-station, corporate actor denial, disabled mode and attempted write. This is a dependency fix needed for Master 021 S-06-R negative HTTP authorization; until protected real QA Chromium verifies the live endpoint it is not accepted, and positive blurred-photo/manual-decision S-06-V remains separately unproven. No fixtures created or deleted.

Do not claim Full Production. Package switching/effective date Issue #205 and original 021–024 positive Master test requirements remain open.
