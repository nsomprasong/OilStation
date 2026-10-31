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
 assert.equal(config.vars.OILSTATION_DEPLOY_TARGET,'production');
 assert.equal(config.env.uat.vars.OILSTATION_DEPLOY_TARGET,'uat');
 assert.equal(config.env.uat.vars.OILSTATION_UAT_SUPABASE_REF,undefined);
 assert.equal(config.env.uat.vars.OILSTATION_UAT_TEST_EMAIL,undefined);
 assert.ok(config.triggers.crons.includes('*/2 * * * *'));
});
test('workflow is manual with pre-deployment production SQL and bindings gates',()=>{
 assert.match(wf,/workflow_dispatch:/);
 assert.equal((wf.match(/npm install --ignore-scripts/g)||[]).length,2);
 assert.doesNotMatch(wf,/^\s+push:/m);
 assert.doesNotMatch(wf,/^\s+pull_request:/m);
 assert.match(wf,/APPROVED_OILSTATION_PRODUCTION_RELEASE/);
 assert.match(wf,/refs\/heads\/main/);
 assert.match(wf,/oilstation_release_status/);
 assert.match(wf,/RELEASE_SERVICE_ROLE_KEY/);
 assert.match(wf,/wrangler@4 secret list/);
 assert.match(wf,/for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY COUPON_SIGNING_KEY; do/);
 assert.doesNotMatch(wf,/for key in[^\n]*OILSTATION_API_ENABLED/);
 assert.match(wf,/\.type == "secret_text"/);
 assert.match(wf,/\/workers\/scripts\/oilstation\/settings/);
 assert.match(wf,/\.name == "OILSTATION_API_ENABLED" and \.type == "plain_text" and \.text == "true"/);
 assert.match(wf,/Production OILSTATION_API_ENABLED must be an explicit plain-text true/);
 assert.match(wf,/wrangler@4 deploy --env uat/);
 assert.match(wf,/wrangler@4 deploy --config wrangler\.production-release\.json/);
 assert.match(wf,/oilstation\.goldensoft\.cloud\/api\/ready/);
});

test('production release preflight supports new Supabase sb_secret key without JWT bearer',()=>{
 assert.match(wf,/auth_headers=\(-H "apikey: \$RELEASE_SERVICE_ROLE_KEY"\)/);
 assert.match(wf,/\[\[ "\$RELEASE_SERVICE_ROLE_KEY" != sb_secret_\* \]\]/);
 assert.match(wf,/auth_headers\+=\(-H "authorization: Bearer \$RELEASE_SERVICE_ROLE_KEY"\)/);
 assert.match(wf,/"\$\{auth_headers\[@\]\}"/);
});

test('approved production deploy uses release-only config rather than resetting runtime flag to false',()=>{
 assert.match(wf,/Prepare explicitly approved production runtime configuration/);
 assert.match(wf,/OILSTATION_API_ENABLED = 'true'/);
 assert.match(wf,/wrangler@4 deploy --config wrangler.production-release.json/);
 assert.match(wf,/wrangler.production-release.json/);
});
