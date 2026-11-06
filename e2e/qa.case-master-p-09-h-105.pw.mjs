import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaLogin,STATION_A,STATION_B,STATION_S02A,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase. No UI POSTs.
const MASTER_UAT_ID='P-09-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded P-09-H authorized workflow',alias:'sales01',role:'platform_sales',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
const first=await page.request.get(BASE+'/api/platform/sales/workspace',{headers});expect(first.status()).toBe(200);const one=(await first.json()).result;expect(one.isAdmin).toBe(false);expect(one.people).toHaveLength(1);expect(one.assignments).toHaveLength(2);expect(new Set(one.assignments.map(x=>x.stationId))).toEqual(new Set([STATION_A,STATION_B]));
const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});const auth2=await qaLogin(p,'sales02','platform_sales','platform');const r=await p.request.get(BASE+'/api/platform/sales/workspace',{headers:auth2.headers});expect(r.status()).toBe(200);const two=(await r.json()).result;expect(two.people).toHaveLength(1);expect(two.assignments).toHaveLength(2);expect(two.people[0].id).not.toBe(one.people[0].id);expect(new Set(two.assignments.map(x=>x.stationId))).toEqual(new Set([STATION_S02A,STATION_S02B]));expect(one.assignments.every(x=>x.salesId===one.people[0].id)).toBe(true);expect(two.assignments.every(x=>x.salesId===two.people[0].id)).toBe(true);}finally{await ctx.close();}
console.log('MASTER_CASE P-09-H BOTH_QA_SALES_TWO_OWN_ASSIGNMENTS_EACH_PASS (platform admin aggregate pending)');
}});
