import {masterCase} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='P-15-R';
masterCase({id:MASTER_UAT_ID,description:'sales-denied-qa-secrets-reset',alias:'sales02',role:'platform_sales',scopeType:'platform',
check:async({page,headers,expect,BASE})=>{
const scope=await page.request.get(BASE+'/api/qa/scopes',{headers});expect(scope.status()).toBe(403);
expect(await scope.json()).toEqual({error:'staff_requires_admin'});
const reset=await page.request.post(BASE+'/api/qa/reset-password',{
 headers:{...headers,origin:BASE,'content-type':'application/json'},
 data:{alias:'sales01',password:'QA-Disabled-Sales-Reset-2026!'}
});expect(reset.status()).toBe(403);expect(await reset.json()).toEqual({error:'staff_requires_admin'});
console.log('MASTER_CASE P-15-R SALES_CANNOT_VIEW_QA_SCOPE_OR_RESET_OTHER_SALES_PASSWORD_PASS');
}});
