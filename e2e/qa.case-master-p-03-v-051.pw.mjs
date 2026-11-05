import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='P-03-V';
masterCase({id:MASTER_UAT_ID,description:'sales-invalid-station-onboarding-boundary',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/platform/sales/stations',{headers});expect(own.status()).toBe(200);
const before=(await own.json()).stations;expect(before).toHaveLength(2);
const invalid=[{organizationName:'A',stationName:'QA UNSAVED',brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false},requestId:'00000000-0000-4000-8000-000000000051'},{organizationName:'QA UNSAVED CORP',stationName:'QA UNSAVED',brandCode:'PTT',modules:{qrCoupon:false,hrPayroll:false},requestId:'00000000-0000-4000-8000-000000000051'}];
for(const data of invalid){const q=await page.request.post(BASE+'/api/platform/sales/create-station',{headers:{...headers,origin:BASE,'content-type':'application/json'},data});expect(q.status()).toBe(400);expect(await q.json()).toEqual({error:'invalid_station'});}
const after=await page.request.get(BASE+'/api/platform/sales/stations',{headers});expect(after.status()).toBe(200);expect((await after.json()).stations).toEqual(before);
console.log('MASTER_CASE P-03-V TOO_SHORT_ORG_AND_ZERO_MODULES_REJECTED_PASS (inactive brand separate)');
}});
