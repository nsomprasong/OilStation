import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8'));
const wf=readFileSync(new URL('../../.github/workflows/controlled-deploy.yml',import.meta.url),'utf8');
test('UAT Worker is distinct from production and has no scheduled money jobs',()=>{
 assert.equal(config.name,'oilstation');
 assert.equal(config.env.uat.name,'oilstation-uat');
 assert.equal(config.env.uat.workers_dev,true);
 assert.deepEqual(config.env.uat.triggers.crons,[]);
 assert.equal(config.env.uat.assets.binding,'ASSETS');
 assert.ok(config.triggers.crons.includes('*/2 * * * *'));
});
test('workflow is manual with pre-deployment production SQL and bindings gates',()=>{
 assert.match(wf,/workflow_dispatch:/);
 assert.doesNotMatch(wf,/^\s+push:/m);
 assert.doesNotMatch(wf,/^\s+pull_request:/m);
 assert.match(wf,/APPROVED_OILSTATION_PRODUCTION_RELEASE/);
 assert.match(wf,/refs\/heads\/main/);
 assert.match(wf,/oilstation_release_status/);
 assert.match(wf,/RELEASE_SERVICE_ROLE_KEY/);
 assert.match(wf,/wrangler@4 secret list/);
 assert.match(wf,/wrangler@4 deploy --env uat/);
 assert.match(wf,/wrangler@4 deploy\s*$/m);
 assert.match(wf,/oilstation\.goldensoft\.cloud\/api\/ready/);
});
