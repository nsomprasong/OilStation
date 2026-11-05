import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: retry only this never-started case after shared helper fixture error; protected guard runs inside test callback.
const MASTER_UAT_ID='P-01-R';
masterCase({id:MASTER_UAT_ID,description:'guest-admin-deep-link-boundary',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
 const anon=await page.request.get(BASE+'/api/platform/billing/overview');expect(anon.status()).toBe(401);
const foreign=await page.request.get(BASE+'/api/platform/billing/overview',{headers});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'permission_denied'});
await expect(page.locator('[data-ws-go="platform-billing"]')).toHaveCount(0);
console.log('MASTER_CASE P-01-R GUEST_401_SALES_DEEPLINK_403_PASS');
 }});
