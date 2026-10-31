import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=readFileSync('e2e/qa.corporate-fixtures.pw.mjs','utf8');
const wf=readFileSync('.github/workflows/qa-owner-corporate-fixtures-temporary.yml','utf8');
test('one-shot Corporate QA browser requires exact owner trigger and protected evidence',()=>{
 for(const s of ["github.ref == 'refs/heads/main'","github.event.issue.number == 56",
  "github.actor == 'nsomprasong'","github.event.comment.author_association == 'OWNER'",
  "/qa-playwright-create-12-companies-20261031-once","environment: oilstation-qa",
  "--grep '@qa-companies'","gpg --batch","qa-corporate-evidence.tar.gz.gpg"])
   assert.ok(wf.includes(s),s);
 assert.doesNotMatch(wf,/pull_request_target:|contents: write|write-all/);
});
test('Corporate QA suite validates zero funds, all 12 companies and no station writes',()=>{
 assert.match(e,/companyAfter\.companyCount\)\.toBe\(12\)/);
 assert.match(e,/for\(const field of \['prepaid','credit','debt','reserved'\]\)/);
 assert.match(e,/role\)\.toBe\('station_owner'\)/);
 assert.match(e,/other.id/);
 assert.match(e,/cross\.status\(\)\)\.toBe\(403\)/);
 assert.match(e,/wrongName\.status\(\)\)\.toBe\(400\)/);
 assert.match(e,/after\[key\].*toEqual\(before\[key\]\)/);
 assert.doesNotMatch(e,/\/api\/topup\/review|\/api\/coupons|\/api\/station\/billing|\/api\/fuel\/start/);
});
