import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../../.github/workflows/playwright-e2e.yml',import.meta.url),'utf8');
test('public PR browser concurrency separated by pull request ID',()=>{
 assert.match(workflow,/github\.event_name == 'pull_request'/);
 assert.match(workflow,/format\('oilstation-public-pr-\{0\}', github\.event\.pull_request\.number\)/);
});
test('authorized QA workflow_dispatch remains on a single shared live-DB queue',()=>{
 assert.match(workflow,/\|\| 'oilstation-playwright-live-db'/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
});
test('PR event only runs public smoke and never authorizes station mutations',()=>{
 assert.match(workflow,/if: github\.event_name == 'pull_request' \|\| inputs\.suite == 'public'/);
 assert.match(workflow,/npm run test:e2e -- --grep '@public'/);
});
