import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='X-05-R';
masterCase({id:MASTER_UAT_ID,description:'driver-html-does-not-mount-corporate-or-station-unauthorized-panes',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const keys=await page.locator('[data-workspace-shell] [data-ws-screen]').evaluateAll(els=>els.map(x=>x.getAttribute('data-ws-screen')).sort());
expect(keys).toEqual(['driver','overview']);
for(const key of ['corporate','customers','finance','hr','payroll','plan','sales','stations','invitations'])expect(await page.locator('[data-ws-screen="'+key+'"]').count()).toBe(0);
expect(await page.locator('#corporate-workspace, #station-finance-workspace, #station-customers-workspace').count()).toBe(0);
const denied=await page.request.get(BASE+'/api/corporate/drivers?companyId='+COMPANY_C01,{headers});
expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
const own=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(own.status()).toBe(200);
console.log('MASTER_CASE X-05-R DRIVER_HTML_NO_FOREIGN_TASK_DOM_AND_API_ROSTER_403_PASS');
}});
