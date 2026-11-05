# OS-QA-ST-FUEL-CROSS-SCOPE-DENIAL-014

- One existing `s01b-owner` QA account (mobile 390×844), station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, foreign QA station s01a `e22fb5ff-1878-446f-ab8d-585115e8a1a9`.
- GET own `/api/station-fuels` succeeds; forbidden GET foreign station returns 403.
- Send **one denied** POST to `/api/station-fuel-config` using a foreign station ID but an existing own-station product ID and its current unchanged price/enable state. This mismatch is deliberate to ensure no legitimate foreign station price is changed even if the scope guard is accidentally bypassed.
- Must return 403 `permission_denied`; own catalog GET afterward identical. Verify no DB audit change, no accepted writes, no payroll/finance effects.
- Protected QA serialized workflow runs ONLY new case spec after matching guarded Preview, no previous cases rerun.
