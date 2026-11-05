import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='C-01-R';
masterCase({id:MASTER_UAT_ID,description:'corporate-admin-foreign-company-account-fuel-denial',alias:'c02-admin',role:'corporate_admin',scopeType:'corporate_company',
 check:async({page,auth,headers,expect,BASE})=>{
expect(auth.membership.corporateCompanyId).not.toBe(COMPANY_C01);
const own=await page.request.get(BASE+'/api/my-accounts',{headers});expect(own.status()).toBe(200);
const accounts=(await own.json()).accounts;expect(accounts.every(a=>a.companyId===auth.membership.corporateCompanyId)).toBe(true);
const foreign=await page.request.get(BASE+'/api/my-accounts/07de207d-97cd-4f46-9683-d431d057c583/fuels',{headers});
expect(foreign.status(),'foreign account fuel list must not leak').toBe(403);
expect(await foreign.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE C-01-R FOREIGN_COMPANY_ACCOUNT_FUELS_DENIED_PASS');
}});
