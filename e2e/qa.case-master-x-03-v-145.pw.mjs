import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='X-03-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-03-V QA evidence',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();const unauth=await p.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A);expect(unauth.status()).toBe(401);const sales=await p.request.get(BASE+'/api/platform/sales/workspace');expect(sales.status()).toBe(401);}finally{await ctx.close();}const own=await page.request.get(BASE+'/api/my-accounts',{headers});expect(own.status()).toBe(200);const denied=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE X-03-V NO_MEMBERSHIP_AUTH_401_AND_CORPORATE_ROLE_NO_STATION_SCOPE_403_PASS (revocation token propagation separately pending)');
}});
