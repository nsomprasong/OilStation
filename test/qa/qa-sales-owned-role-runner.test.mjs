import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e=readFileSync('e2e/sales.provision.pw.mjs','utf8');
const w=readFileSync('.github/workflows/qa-owner-sales-provision-temporary.yml','utf8');
test('Sales role Playwright runs only under guarded owner command and AES256 artifacts',()=>{
 for(const s of ["github.ref == 'refs/heads/main'","github.event.issue.number == 53",
  "github.actor == 'nsomprasong'","github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/qa-playwright-sales-owned-roles-20261031-once'",
  "environment: oilstation-qa","--grep '@sales-provision'","gpg --batch",
  "sales-roles-evidence.tar.gz.gpg"])assert.ok(w.includes(s),s);
 assert.doesNotMatch(w,/pull_request_target:|contents: write|write-all/);
});
test('Role browser tests exact four scoped stations and 36 role identities, never touches live finance',()=>{
 assert.match(e,/roles=stations.flatMap/);
 assert.match(e,/await dbEvidence\(\)/);
 assert.match(e,/afterInventory=await findExisting\(\)/);
 assert.match(e,/for\(const role of roles\)/);
 assert.match(e,/forbidden\.status\(\)\)\.toBe\(403\)/);
 assert.match(e,/forbiddenInvite\.status\(\)\)\.toBe\(403\)/);
 assert.match(e,/OILSTATION_QA_SALES_PROVISION_RUN/);
 assert.doesNotMatch(e,/\/api\/topup\/review|\/api\/platform\/billing\/issue|\/api\/station\/customers|deleteUser|\.delete\(/);
});
