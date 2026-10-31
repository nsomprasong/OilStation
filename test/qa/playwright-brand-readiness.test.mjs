import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const qa=readFileSync('e2e/platform.qa.pw.mjs','utf8');
test('authenticated Playwright waits for actual fuel brand API and DOM options',()=>{
 assert.match(qa,/page\.request\.get\(BASE \+ '\/api\/fuel-brands'/);
 assert.match(qa,/expect\(brandsResponse\.status\(\)\)\.toBe\(200\)/);
 assert.match(qa,/await expect\.poll\(async \(\) => options\.count\(\)/);
 assert.match(qa,/expect\(allowedBrands\)\.toContain\(visibleBrandOptions\[0\]\)/);
 assert.match(qa,/selectOption\(visibleBrandOptions\[0\]\)/);
 assert.doesNotMatch(qa,/waitForTimeout\(/);
});
