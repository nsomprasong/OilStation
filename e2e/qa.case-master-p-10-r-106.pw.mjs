import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_S02A,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase. No UI POSTs.
const MASTER_UAT_ID='P-10-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded P-10-R authorized workflow',alias:'sales02',role:'platform_sales',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
const url=BASE+'/api/platform/sales/stations';const before=await page.request.get(url,{headers});expect(before.status()).toBe(200);const own=(await before.json()).stations;expect(new Set(own.map(x=>x.id))).toEqual(new Set([STATION_S02A,STATION_S02B]));const denied=await page.request.post(BASE+'/api/platform/create-station',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{organizationName:'QA NEVER ADMIN ROLE',stationName:'QA NEVER ADMIN STATION',brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false}}});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});const after=await page.request.get(url,{headers});expect(after.status()).toBe(200);expect((await after.json()).stations).toEqual(own);console.log('MASTER_CASE P-10-R SALES_CANNOT_USE_PLATFORM_ADMIN_STATION_CREATE_PASS');
}});
