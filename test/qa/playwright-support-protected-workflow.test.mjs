import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const y=readFileSync('.github/workflows/playwright-e2e.yml','utf8');
const e=readFileSync('e2e/platform.support.pw.mjs','utf8');
test('Support protected workflow is manual-main-only and never reuses Sales credentials',()=>{
 assert.match(y,/options: \[public, authorized-platform, authorized-qa-finance, authorized-support\]/);
 assert.match(y,/github\.ref == 'refs\/heads\/main' && inputs\.suite == 'authorized-support'/);
 assert.match(y,/environment: oilstation-qa/);
 assert.match(y,/OILSTATION_QA_SUPPORT01_PASSWORD: \$\{\{ secrets\.OILSTATION_QA_SUPPORT01_PASSWORD \}\}/);
 assert.match(y,/run: npm run test:e2e -- --grep '@support'/);
 assert.match(y,/gpg --batch/);
 assert.match(y,/support-evidence\.tar\.gz\.gpg/);
 assert.match(e,/await qaEvidence\(\)/);
 assert.match(e,/\b403\b/);
 assert.doesNotMatch(e,/\.post\(BASE\+'\/api\/platform\/sales\/create-station'/);
});
