import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='P-05-V';
masterCase({id:MASTER_UAT_ID,description:'invalid-platform-plan-fields-rejected',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const endpoint=BASE+'/api/platform/billing/flat-plan';
const base={code:'qa_badplan',name:'QA rejected plan',frequency:'monthly',couponPriceSatang:'2000',hrPriceSatang:'1500',effectiveOn:'2026-11-06'};
const cases=[{...base,couponPriceSatang:'-1'},{...base,couponPriceSatang:undefined},{...base,effectiveOn:'2026-02-30'},{...base,hrPriceSatang:'1.5'}];
for(const input of cases){
 const res=await page.request.post(endpoint,{headers:{...headers,origin:BASE,'content-type':'application/json'},data:input});
 expect(res.status(),'all invalid billing variants must fail input validation').toBe(400);
 expect(await res.json()).toEqual({error:'invalid_platform_billing'});
}
console.log('MASTER_CASE P-05-V MISSING_NEGATIVE_PRICE_AND_INVALID_DATE_REJECTED_PASS');
}});
