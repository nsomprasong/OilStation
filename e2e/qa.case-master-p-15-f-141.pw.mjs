import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaIsEnabled} from '../src/api/qa-accounts.mjs';
import {readFileSync} from 'node:fs';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='P-15-F';
masterCase({id:MASTER_UAT_ID,description:'new bounded P-15-F QA evidence',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const live=await page.request.get(BASE+'/api/public-config');expect(live.status()).toBe(200);expect((await live.json()).qaModeEnabled).toBe(true);const v=JSON.parse(readFileSync('wrangler.jsonc','utf8')).vars;const ready={...v,OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001'};expect(qaIsEnabled(ready)).toBe(true);for(const [key,value] of [['OILSTATION_QA_MODE_ENABLED','false'],['OILSTATION_PREVIEW_LOGIN_ENABLED','false'],['OILSTATION_API_ENABLED','true'],['OILSTATION_DEPLOY_TARGET','uat']])expect(qaIsEnabled({...ready,[key]:value}),key).toBe(false);const own=await page.request.get(BASE+'/api/station/customer-overview?stationId=e22fb5ff-1878-446f-ab8d-585115e8a1a9',{headers});expect(own.status()).toBe(200);expect((await own.json()).accounts).toHaveLength(3);console.log('MASTER_CASE P-15-F QA_MODE_FLAG_FAIL_CLOSED_FOUR_VARIANTS_WITH_LIVE_BASELINE_PASS (live QA-off rollout not performed)');
}});
