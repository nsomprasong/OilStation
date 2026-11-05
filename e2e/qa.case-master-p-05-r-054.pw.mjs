import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='P-05-R';
masterCase({id:MASTER_UAT_ID,description:'sales-cannot-edit-platform-plan',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const data={planId:'00000000-0000-4000-8000-000000000054',code:'qa_never_saved',name:'QA unauthorized plan',frequency:'monthly',couponPriceSatang:'1000',hrPriceSatang:'1000',bundlePriceSatang:'1500',effectiveOn:'2026-11-06'};
const response=await page.request.post(BASE+'/api/platform/billing/edit-plan',{headers:{...headers,origin:BASE,'content-type':'application/json'},data});
expect(response.status()).toBe(403);expect(await response.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE P-05-R SALES_EDIT_PLAN_ROLE_DENIED_PASS');
}});
