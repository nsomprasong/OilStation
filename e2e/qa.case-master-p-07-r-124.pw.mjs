import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,qaLogin} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN new only; no accepted writes.
const MASTER_UAT_ID='P-07-R';
masterCase({id:MASTER_UAT_ID,description:'bounded P-07-R role and validation acceptance',alias:'c02-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'7f3dae09-5ff4-409c-bdf8-049086f99b7a',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/my-accounts',{headers});expect(own.status()).toBe(200);expect((await own.json()).accounts.length).toBeGreaterThan(0);const forbidden=await page.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});const owner=await qaLogin(p,'s01a-owner','station_owner','station',STATION_A);const allowed=await p.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers:owner.headers});expect(allowed.status()).toBe(200);}finally{await ctx.close();}console.log('MASTER_CASE P-07-R COMPANY_C02_CANNOT_READ_STATION_BILLING_WHILE_OWNER_CAN_PASS (invoice history tenant check pending)');
}});
