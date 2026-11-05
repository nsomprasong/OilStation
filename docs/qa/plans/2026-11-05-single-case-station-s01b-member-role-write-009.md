# OilStation QA 009 — one synthetic station role change and restoration

The verified target is QA-only email qa-s01b-attendant@qa.oilstation.invalid, membership 65d3c545-59b3-4704-9f52-2133ec741e36, station 76388e2c-ef36-4656-808b-7d0fbd1d2c35. Production Supabase preflight showed one active attendant membership, one scope, zero linked HR employees, fuel sessions, drivers, coupons or actor audit actions. The actor is existing s01b-owner in protected QA mode.

Use real Chromium mobile 390x844. From Invitations / Member Directory, change that exact synthetic staff role from attendant to pump_staff using UI Save; confirm response 200, UI and scoped API GET. The try/finally recovers original attendant via authenticated /api/members/change even after assertion failures, and verifies active role afterward. Never deactivate, invite, touch financial operations or alter another identity.

After run inspect Supabase: memberships 100, station 7, original attendant restored, two corresponding membership_role_changed audit entries, invitations 2, and payroll_runs 0. If restoration failed, immediately recover exact QA identity and mark case FAIL/BLOCKED; do not continue to another write case. Release gates remain locked. Prior case IDs 002-008 are not rerun.
