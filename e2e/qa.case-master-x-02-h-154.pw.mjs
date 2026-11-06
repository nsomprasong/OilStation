import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaLogin,STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: only six new authorized QA acceptance cases.
const MASTER_UAT_ID='X-02-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-02-H evidence verification',alias:'s02a-owner',role:'station_owner',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const endpoint=BASE+'/api/station/customer-overview?stationId='+STATION_S02A;const first=await page.request.get(endpoint,{headers});expect(first.status()).toBe(200);const a=(await first.json()).accounts;expect(a).toHaveLength(3);const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});const fresh=await qaLogin(p,'s02a-owner','station_owner','station',STATION_S02A);const result=await p.request.get(endpoint,{headers:fresh.headers});expect(result.status()).toBe(200);const rows=(await result.json()).accounts;expect(rows).toEqual(a);expect(new Set(rows.map(x=>x.companyName)).size).toBe(3);}finally{await ctx.close();}console.log('MASTER_CASE X-02-H SECOND_FRESH_AUTH_LOGIN_MATCHES_REAL_CROSS_COMPANY_ROWS_PASS (write response not generated)');
}});
