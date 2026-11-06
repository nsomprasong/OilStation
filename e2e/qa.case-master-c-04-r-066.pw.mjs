import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='C-04-R';
masterCase({id:MASTER_UAT_ID,description:'driver-cannot-invite-finance-manager',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const denied=await page.request.post(BASE+'/api/invitations/create',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{email:'qa-denied-c01-finance@qa.oilstation.invalid',roleCode:'finance_manager',scopeType:'corporate_company',scopeId:COMPANY_C01}});
expect(denied.status(),'driver cannot invite a finance manager').toBe(403);
expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE C-04-R DRIVER_FINANCE_MANAGER_INVITE_DENIED_PASS');
}});
