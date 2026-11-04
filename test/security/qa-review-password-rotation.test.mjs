import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../../scripts/qa-rotate-review-passwords.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../../.github/workflows/qa-review-login-password.yml',import.meta.url),'utf8');

test('review login rotation can only run manually with a separate secret',()=>{
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/\n\s+(push|pull_request|schedule):/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/inputs\.confirm == 'RESET-22-QA-SAMPLES'/);
 assert.match(workflow,/environment: oilstation-qa/);
 assert.match(workflow,/secrets\.OILSTATION_QA_DB_KEY/);
 assert.match(workflow,/secrets\.OILSTATION_QA_REVIEW_PASSWORD/);
 assert.doesNotMatch(workflow,/password:\s*\$\{\{\s*inputs\./i);
 assert.doesNotMatch(workflow,/echo .*OILSTATION_QA_REVIEW_PASSWORD/i);
 assert.match(workflow,/--dry-run/);
 assert.match(workflow,/--apply/);
});
test('only 22 frozen QA sample aliases; no real or wildcard password reset',()=>{
 assert.match(script,/OILSTATION_QA_ROTATE_CONFIRM/);
 // The sample review workflow enforces exactly eight upper/lower/numeric
 // characters; it never embeds a shared password or accepts a password input.
 assert.ok(script.includes('normalizeQaReviewPassword(process.env.OILSTATION_QA_REVIEW_PASSWORD)'));
 assert.ok(script.includes("if(!password)"));
 assert.ok(script.includes("GITHUB_EVENT_NAME!=='workflow_dispatch'"));
 assert.ok(!workflow.includes('password: ${{ inputs.'));
 assert.match(script,/QA-20261031-PLATFORM-001/);
 assert.match(script,/Array\.from\(\{length:4\}/);
 assert.match(script,/Array\.from\(\{length:12\}/);
 assert.match(script,/s01a','s01b','s02a','s02b/);
 assert.match(script,/'sales01','sales02'/);
 assert.match(script,/oilstation_qa!==true/);
 assert.match(script,/oilstation_qa_run_id!==QA_RUN/);
 assert.match(script,/email_confirmed_at/);
 assert.match(script,/accounts\.size!==selected\.length/);
 assert.match(script,/client\.auth\.admin\.updateUserById\(u\.id,\{password\}\)/);
 assert.match(script,/signInWithPassword\(\{email:u\.email,password\}\)/);
 assert.doesNotMatch(script,/auth\.admin\.deleteUser|\.delete\(/);
 assert.doesNotMatch(script,/console\.log\([^\n]*password\)/i);
});
