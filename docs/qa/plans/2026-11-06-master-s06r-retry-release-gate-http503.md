# S-06-R targeted failed-only retry — first real run #42175321597

Initial protected QA script logged owner A photo GET 200, private storage asset verified. It failed before trying the foreign station assertions because the test expected POST manual approval 404. Production finance-off Worker deliberately returns **HTTP503 {error:"release_not_enabled"}** for this blocked write. The app's release guard was correctly closed, so only the test assertion needs repair.

Changes are solely the exact failed S-06-R QA test and the protected workflow's allowlist from NEW A to this exact MODIFIED M file. The existing 001–158 bounded PASS cases and every other e2e spec must NEVER be rerun. Zero financial/HR/plate evidence writes. After PR CI 12/12, same merge-SHA Preview, protected one-case Chromium 1/1 and SQL invariance, the new bounded S-06-R **negative** photo privacy case may be recorded verified. Other five Master Batch 021 cases remain untested/blocked.
