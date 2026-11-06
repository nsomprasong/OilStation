# Protected single failed-case retry: S-09-H / 115

Previous [Batch 013 Chromium](https://github.com/nsomprasong/OilStation/actions/runs/42160457196) verified the API returned three real QA-S02-A linked companies and the browser rendered three cards, but failed at strict-mode Playwright collection assertion `expect(cards).toContainText(...)`. This is a **test locator bug**, not a proven product bug.

This recovery modifies exactly existing **failed spec 115**, replacing ambiguous multi-card text assertion with one-card-per-name assertion, and updates only the guarded workflow allowlist to permit the **known failed 115** in isolation (not all 6 Batch 013 cases). No changes to product API, UI, DB or runtime release flags.

Gate: PR CI 12/12, same-commit guarded preview, serialized protected Chrome exactly 1/1, no accepted business/HR/finance writes, production SQL counts invariant. All previously passed specs 001–114 and 116–128 are **never rerun**. The five other blocked negative cases plus #205 remain open. Do not claim the positive creation-of-new-customer variant passed merely from existing listing.
