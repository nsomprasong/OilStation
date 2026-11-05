# OS-QA-ST-MEMBER-CROSS-SCOPE-DENIAL-010 — cross-station RLS/authorization boundary

- Completed prior case 009 recovered successfully, SQL role now corrected, audit baseline 260. Do NOT rerun cases 001–009.
- Single actor: QA s01a-owner, station e22fb5ff-1878-446f-ab8d-585115e8a1a9; verify exactly one station_owner scope from /api/me. Attempt to mutate a synthetic s01b staff membership 65d3c545-59b3-4704-9f52-2133ec741e36, station 76388e2c-ef36-4656-808b-7d0fbd1d2c35.
- Expected one POST to /api/members/change with action edit and **same existing attendant role**; 403 permission_denied, so no effective permission change even if mistakenly accepted. Then one scoped GET of s01b member directory also 403 permission_denied.
- Post-run independently check target still attendant, active and audit count 260 (no cross-station audit added).
- Run 390x844 protected Chromium only case 010 after matching guarded Preview. No customer/HR/finance change, no link to real employee or fuel/coupon.
