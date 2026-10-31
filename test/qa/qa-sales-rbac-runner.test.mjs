import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync('e2e/platform.qa.pw.mjs','utf8');
const wf=readFileSync('.github/workflows/qa-owner-sales-guard-temporary.yml','utf8');
test('real Sales RBAC Browser is strictly read-only with before/after QA snapshots',()=>{
 const section=file.slice(file.indexOf("test('P-04/P-15 Sales cannot"));
 assert.ok(section.length>900);
 assert.match(section,/@sales-guard/);
 assert.match(section,/validateFixture\(before,4\)/);
 for(const p of ['/api/qa/scopes','/api/platform/stations','/api/platform/billing/overview','/api/platform/support/overview'])
  assert.ok(section.includes(p),p);
 assert.match(section,/response\.status\(\).*\.toBe\(403\)/);
 assert.match(section,/390,height:844/);
 assert.match(section,/after\.requests\)\.toEqual\(before\.requests\)/);
 assert.doesNotMatch(section,/\.post\(|\.put\(|\.patch\(|\.delete\(|waitForTimeout\(/);
});
test('one-shot real browser trigger uses only owner, exact command, main and encrypted artifacts',()=>{
 for(const literal of ["github.ref == 'refs/heads/main'","github.event.issue.number == 49",
  "github.actor == 'nsomprasong'","github.event.comment.author_association == 'OWNER'",
  "/qa-playwright-sales-guard-20261031-once","environment: oilstation-qa",
  "run: npm run test:e2e -- --grep '@sales-guard'","gpg --batch",
  "sales-guard-evidence.tar.gz.gpg"]){assert.ok(wf.includes(literal),literal);}
 assert.doesNotMatch(wf,/pull_request_target:|contents: write|write-all/);
});
