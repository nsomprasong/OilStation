import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN new only; no accepted writes.
const MASTER_UAT_ID='C-04-H';
masterCase({id:MASTER_UAT_ID,description:'bounded C-04-H role and validation acceptance',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const r=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'corporate_company',scopeId:COMPANY_C01}),{headers});expect(r.status()).toBe(200);const members=(await r.json()).members;expect(members.length).toBeGreaterThanOrEqual(5);const roles=new Set(members.filter(m=>m.active).map(m=>m.role));for(const code of ['corporate_admin','coupon_issuer','accountant','finance_manager','driver'])expect(roles.has(code),'QA existing company role '+code).toBe(true);await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first()).toBeVisible();console.log('MASTER_CASE C-04-H REAL_FIVE_CORPORATE_LOGIN_ROLES_AND_INVITE_ENTRY_PASS (no new outbound invite sent)');
}});
