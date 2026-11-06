import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaLogin} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded fresh cases.
const MASTER_UAT_ID='X-03-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-03-H authorized evidence',alias:'support01',role:'platform_support',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/platform/support/overview',{headers});expect(own.status()).toBe(200);expect((await own.json()).result.readOnly).toBe(true);const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});const sales=await qaLogin(p,'sales01','platform_sales','platform');const res=await p.request.get(BASE+'/api/platform/support/overview',{headers:sales.headers});expect(res.status()).toBe(403);expect(await res.json()).toEqual({error:'permission_denied'});}finally{await ctx.close();}console.log('MASTER_CASE X-03-H SUPPORT_READONLY_PERMITTED_SALES_DENIED_BY_SERVER_PASS (mutating workflows not exercised)');
}});
