# OS-QA-ST-FUEL-PRICE-INVALID-013 — one station, invalid UI price only

- Continue after completed 011 and 012, no reruns of 001–012 or old 4-station fuel price positive suite.
- Existing QA station s01b (390×844); owner logs in using protected GitHub Secret and verifies one `station_owner` membership.
- GET scoped `/api/station-fuels` before. Navigate Home > Fuel, expand **one** fuel row via its existing Edit button. Attempt 0, negative and >4-decimal values separately, click Save on each and require the form's native localized validation. Track all `/api/` writes and require **zero**.
- Restore input draft (not saved), re-read actual API, verify selected fuel price and enabled status unchanged. No pump, real finance or production price mutation.
- Protected serial Chromium only this spec after matching guarded Preview. Direct SQL baseline after previous cases: total memberships 100, s01b 7, audit 260, payroll runs 0.
