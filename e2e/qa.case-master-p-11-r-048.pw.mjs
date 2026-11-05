import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-11-R';
masterCase({id:MASTER_UAT_ID,description:'sales-cannot-transfer-own-sales-assignment',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const denied=await page.request.post(BASE+'/api/platform/sales/transfer',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,salesUserId:'00000000-0000-4000-8000-000000000048',reason:'Unauthorized QA role authorization check'}});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE P-11-R SALES_CANNOT_TRANSFER_ASSIGNMENT_PASS');
}});
