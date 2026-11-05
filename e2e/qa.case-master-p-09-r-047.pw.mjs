import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-09-R';
masterCase({id:MASTER_UAT_ID,description:'sales-platform-superadmin-create-denial',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const denied=await page.request.post(BASE+'/api/qa/accounts',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{alias:'qa-unauthorized-superadmin',scopeType:'platform',scopeId:null,roleCode:'platform_superadmin'}});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'staff_requires_admin'});
console.log('MASTER_CASE P-09-R SALES_CANNOT_CREATE_SUPERADMIN_PASS');
}});
