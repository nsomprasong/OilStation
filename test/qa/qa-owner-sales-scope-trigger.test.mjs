import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wf=readFileSync('.github/workflows/qa-owner-sales-scope-temporary.yml','utf8');
test('Owner-triggered Sales isolation browser QA is read-only and strictly permission gated',()=>{
 for(const required of [
  "github.repository == 'nsomprasong/OilStation'",
  "github.ref == 'refs/heads/main'",
  "github.event.issue.number == 45",
  "github.actor == 'nsomprasong'",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/qa-sales-readonly-20261031-once'",
  'environment: oilstation-qa',
  "OILSTATION_QA_SALES_SCOPE_RUN: 'true'",
  "--grep '@sales-scope'",
  'gpg --batch',
  'sales-scope.tar.gz.gpg'
 ])assert.ok(wf.includes(required),required);
 assert.doesNotMatch(wf,/OILSTATION_QA_ALLOW_CREATE|contents: write|\bPOST \/api\/platform\/sales\/create-station/);
});
