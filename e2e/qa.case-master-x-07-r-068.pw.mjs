import {masterCase,COMPANY_C01,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='X-07-R';
masterCase({id:MASTER_UAT_ID,description:'corporate-accountant-audit-read-denied',alias:'c01-accountant',role:'accountant',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const unauth=await page.request.get(BASE+'/api/platform/sales/activity?stationId='+STATION_B);
expect(unauth.status()).toBe(401);
expect(await unauth.json()).toEqual({error:'unauthenticated'});
const denied=await page.request.get(BASE+'/api/platform/sales/activity?stationId='+STATION_B,{headers});
expect(denied.status(),'corporate accountant must not read station Sales audit').toBe(403);
expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE X-07-R NONSALES_AUDIT_READ_401_AND_403_PASS');
}});
