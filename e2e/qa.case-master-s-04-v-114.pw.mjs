import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// FAILED_ONLY_RECOVERY_20261106
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-04-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-04-V authorized scope',alias:'s01a-cashier',role:'cashier',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
for(const qrPayload of ['NOT-A-SIGNED-QR','00000000-0000-4000-8000-000000000000.INVALID_SIG','']){const res=await page.request.post(BASE+'/api/station/scan-qr',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{qrPayload}});expect(res.status()).toBe(400);expect(await res.json()).toEqual({error:'invalid_qr'});}const sealed='00000000-0000-4000-8000-000000000000.'+'0'.repeat(64);const blocked=await page.request.post(BASE+'/api/station/scan-qr',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{qrPayload:sealed}});expect(blocked.status()).toBe(503);expect(await blocked.json()).toEqual({error:'qa_finance_disabled'});await page.locator('[data-ws-screen="overview"] [data-ws-go="pump"]:visible').first().click();await expect(page.locator('[data-ws-screen="pump"]:visible')).toBeVisible();console.log('MASTER_CASE S-04-V THREE_MALFORMED_SIGNED_QR_FORMATS_REJECTED_PASS (expired/revoked signed tokens not tried)');
}});
