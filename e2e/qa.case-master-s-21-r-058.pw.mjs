import {masterCase,STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='S-21-R';
masterCase({id:MASTER_UAT_ID,description:'station-owner-cross-station-saas-selection-denial',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers});expect(own.status()).toBe(200);const before=(await own.json()).result;
const denied=await page.request.post(BASE+'/api/station/billing/select',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_B,planId:'00000000-0000-4000-8000-000000000058',paymentMethod:'card'}});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
const fresh=await page.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers});expect(fresh.status()).toBe(200);expect((await fresh.json()).result.selected).toEqual(before.selected);
console.log('MASTER_CASE S-21-R CROSS_STATION_SAAS_SELECT_DENIED_PASS');
}});
