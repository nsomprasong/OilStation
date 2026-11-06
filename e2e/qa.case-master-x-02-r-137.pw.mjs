import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_S02A,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected six entirely new cases.
const MASTER_UAT_ID='X-02-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-02-R authenticated UAT',alias:'s02a-owner',role:'station_owner',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_S02A}),{headers});expect(own.status()).toBe(200);const members=(await own.json()).members;expect(members.length).toBeGreaterThanOrEqual(5);const denied=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_A}),{headers});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});const cards=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_S02A,{headers});expect(cards.status()).toBe(200);expect((await cards.json()).accounts).toHaveLength(3);console.log('MASTER_CASE X-02-R SAME_AUTH_ACTOR_REAL_DIRECTORY_AND_STATION_ACCOUNTS_BOUND_TO_ONE_SCOPE_PASS (financial write actor proof unproven)');
}});
