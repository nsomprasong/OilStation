import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-07-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-07-R tenant denied action',alias:'s02b-owner',role:'station_owner',scopeType:'station',scopeId:'02183a4e-47b0-4575-9f4f-74cec6553205',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/evidence/fuel/reviews?stationId='+STATION_S02B,{headers});expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).reviews)).toBe(true);const bad=await page.request.get(BASE+'/api/evidence/fuel/reviews?stationId='+STATION_A,{headers});expect(bad.status()).toBe(403);expect(await bad.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE S-07-R FOREIGN_STATION_FUEL_COMPLETION_REVIEW_QUEUE_DENIED_PASS (finish mutation not performed)');
}});
