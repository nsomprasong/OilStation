import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='P-15-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded P-15-R authorized scope',alias:'sales01',role:'platform_sales',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
for(const [path,data] of [['/api/qa/reset-password',{alias:'sales02',password:'QaOnly12345!'}],['/api/qa/accounts',{alias:'qa-not-allowed',password:'QaOnly123456789!',roleCode:'platform_sales',scopeType:'platform',scopeId:null}]]){const res=await page.request.post(BASE+path,{headers:{...headers,origin:BASE,'content-type':'application/json'},data});expect(res.status(),path).toBe(403);expect(await res.json()).toEqual({error:'staff_requires_admin'});}const options=await page.request.get(BASE+'/api/qa/scopes',{headers});expect(options.status()).toBe(403);expect(await options.json()).toEqual({error:'staff_requires_admin'});console.log('MASTER_CASE P-15-R SALES_DENIED_QA_RESET_CREATE_AND_SCOPE_CONFIG_PASS');
}});
