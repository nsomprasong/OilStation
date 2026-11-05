import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='P-03-R';
masterCase({id:MASTER_UAT_ID,description:'sales-forged-creator-id-field-rejected',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
for(const injected of [{salesUserId:'00000000-0000-4000-8000-000000000052'},{ownerId:'00000000-0000-4000-8000-000000000052'}]){
const data={organizationName:'QA UNSAVED ORGANIZATION',stationName:'QA UNSAVED STATION',brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false},requestId:'00000000-0000-4000-8000-000000000052',...injected};
const response=await page.request.post(BASE+'/api/platform/sales/create-station',{headers:{...headers,origin:BASE,'content-type':'application/json'},data});
expect(response.status()).toBe(400);expect(await response.json()).toEqual({error:'invalid_station'});
}
console.log('MASTER_CASE P-03-R FORGED_CREATOR_OWNER_FIELDS_REJECTED_PASS');
}});
