import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-06-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-06-R tenant denied action',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/evidence/plate/reviews?stationId='+STATION_B,{headers});expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).reviews)).toBe(true);const bad=await page.request.get(BASE+'/api/evidence/plate/reviews?stationId='+STATION_A,{headers});expect(bad.status()).toBe(403);expect(await bad.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE S-06-R FOREIGN_STATION_PLATE_PHOTO_REVIEW_QUEUE_403_PASS (private image-byte access pending)');
}});
