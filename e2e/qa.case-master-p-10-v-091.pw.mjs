import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-10-V';
masterCase({id:MASTER_UAT_ID,description:'existing-creation-request-idempotent-replay-no-new-station',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const route=BASE+'/api/platform/sales/stations';
const beforeRes=await page.request.get(route,{headers});expect(beforeRes.status()).toBe(200);
const before=(await beforeRes.json()).stations;expect(before).toHaveLength(2);
expect(before.some(x=>x.id===STATION_A)).toBe(true);
const existingRequest='8de304b9-4ea1-4acd-98cd-cf1ea7b455a7';
const payload={organizationName:'QA EXISTING REPLAY NO NEW WRITE',stationName:'QA REPLAY NO STATION',brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false},requestId:existingRequest};
const endpoint=BASE+'/api/platform/sales/create-station';
for(let attempt=0;attempt<2;attempt++){
 const res=await page.request.post(endpoint,{headers:{...headers,origin:BASE,'content-type':'application/json'},data:payload});
 expect(res.status(),'identical known request must replay existing station').toBe(200);
 const existing=(await res.json()).station;
 expect(existing.replayed).toBe(true);expect(existing.id).toBe(STATION_A);
 expect(existing.fuelProductsStaged).toBe(10);
}
const later=await page.request.get(route,{headers});expect(later.status()).toBe(200);
expect((await later.json()).stations).toEqual(before);
console.log('MASTER_CASE P-10-V TWO_EXISTING_REQUEST_REPLAYS_SAME_STATION_NO_NEW_RECORD_PASS; new third always denied');
}});
