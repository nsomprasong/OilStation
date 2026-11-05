# OS-QA-CO-DRIVER-VEHICLE-WRITE-DENIAL-022

- One new never-run Corporate/Driver permission test. Exclude prior PASS cases 002-019 and 021; positive SaaS checkout case 020 stays BLOCKED.
- Actor: existing QA c01-driver, same corporate company c01, mobile 390x844.
- Validate protected QA login and /api/me exactly one driver membership for company c01. Driver has its own workspace but no corporate admin navigation.
- GET /api/driver/coupons to snapshot actor's own current vehicle and coupons, then exactly ONE authenticated structurally valid POST /api/corporate/driver-vehicle for the SAME company. Demand HTTP 403 with exactly {error:'permission_denied'} and no confidential data.
- The request contains deliberately nonexistent valid UUID 00000000-0000-4000-8000-000000000022, plate QA 9022. Because the SQL function checks that the target user is an active company driver before modifying the vehicle, no valid assignment can occur even on route authorization regression.
- After denied POST, re-read own inbox and require unchanged vehicles and coupons; compare independent Supabase counts for c01 drivers, c01 vehicles, audit events, coupons, checkout and payroll before/after.
- No accepted data mutation, no real driver plate changes, no QR issuance, wallet or finance, no Stripe or HR payroll. Do not unlock business release gates.
- Previous corporate role tests checked GET roster isolation; THIS case checks new forbidden driver POST, not prior authorized Corporate Admin assignment.
- Require PR CI 12/12; exact SHA matching guarded Preview, then exactly this one protected Chromium test. No broad test suite reruns and no Full Production flag.
