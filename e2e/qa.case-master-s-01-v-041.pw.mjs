import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: retry only this never-started case after shared helper fixture error; protected guard runs inside test callback.
const MASTER_UAT_ID='S-01-V';
masterCase({id:MASTER_UAT_ID,description:'station-id-required-validation',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
 for(const query of ['','?stationId=not-a-uuid']){
 const response=await page.request.get(BASE+'/api/station/customer-overview'+query,{headers});
 expect(response.status(),'malformed or missing station selector must fail').toBe(400);
 expect(await response.json()).toEqual({error:'invalid_station'});
}
const own=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});
expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).accounts)).toBe(true);
console.log('MASTER_CASE S-01-V INVALID_STATION_DENIED_OWN_ALLOWED_PASS');
 }});
