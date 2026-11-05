import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='P-06-R';
masterCase({id:MASTER_UAT_ID,description:'customer-cannot-read-or-forge-vat',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const forbidden=await page.request.get(BASE+'/api/platform/billing/overview',{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});
const invalid=await page.request.post(BASE+'/api/platform/billing/tax',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{vatMode:'inclusive',rateBasisPoints:-1,effectiveOn:'2026-11-06'}});
expect(invalid.status()).toBe(400);expect(await invalid.json()).toEqual({error:'invalid_platform_billing'});
console.log('MASTER_CASE P-06-R CORPORATE_BILLING_READ_DENIED_AND_INVALID_TAX_WRITE_REJECTED_PASS (valid tax authorization not yet proven)');
}});
