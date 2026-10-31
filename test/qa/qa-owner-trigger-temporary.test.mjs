import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const yaml=readFileSync('.github/workflows/qa-owner-trigger-temporary.yml','utf8');
test('temporary QA dispatch is owner-only, main-only, scoped, and encrypts proof',()=>{
  assert.match(yaml,/issue_comment:/);
  assert.match(yaml,/github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml,/github\.event\.issue\.number == 34/);
  assert.match(yaml,/github\.event\.issue\.pull_request != null/);
  assert.match(yaml,/github\.actor == 'nsomprasong'/);
  assert.match(yaml,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(yaml,/github\.event\.comment\.body == '\/qa-playwright-platform-20261031-once'/);
  assert.match(yaml,/environment: oilstation-qa/);
  assert.match(yaml,/OILSTATION_QA_ALLOW_CREATE: 'true'/);
  assert.match(yaml,/--grep '@auth'/);
  assert.match(yaml,/gpg --batch/);
  assert.match(yaml,/\.gpg/);
  assert.doesNotMatch(yaml,/pull_request_target:|write-all|contents: write/);
});
