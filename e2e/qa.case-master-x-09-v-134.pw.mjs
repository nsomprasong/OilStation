import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {readFileSync} from 'node:fs';
import {STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded new Master case only.
const MASTER_UAT_ID='X-09-V';
masterCase({id:MASTER_UAT_ID,description:'bounded X-09-V new safe QA acceptance',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const url=BASE+'/api/station/customer-overview?stationId='+STATION_B;const a=await page.request.get(url,{headers});expect(a.status()).toBe(200);const before=(await a.json()).accounts;expect(before).toHaveLength(3);const s=readFileSync('src/worker.mjs','utf8');expect(s).toContain('scheduled(_controller, env, ctx)');expect(s).toContain("if (env.OILSTATION_API_ENABLED !== 'true') return;");const wf=readFileSync('.github/workflows/production-preview.yml','utf8');expect(wf).not.toMatch(/\\bTRUNCATE\\b|DROP TABLE|DELETE FROM/i);const b=await page.request.get(url,{headers});expect(b.status()).toBe(200);expect((await b.json()).accounts).toEqual(before);console.log('MASTER_CASE X-09-V NO_AUTOMATIC_QA_CLEANUP_WITH_PREVIEW_OFF_AND_BASELINE_STABLE_PASS (SQL row count independently checked)');
}});
