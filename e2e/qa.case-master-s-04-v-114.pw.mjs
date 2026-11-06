import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-04-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-04-V authorized scope',alias:'s01a-cashier',role:'cashier',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
for(const qrPayload of ['NOT-A-SIGNED-QR','00000000-0000-4000-8000-000000000000.INVALID_SIG','']){const res=await page.request.post(BASE+'/api/station/scan-qr',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{qrPayload}});expect(res.status()).toBe(400);expect(await res.json()).toEqual({error:'invalid_qr'});}await page.locator('[data-ws-screen="overview"] [data-ws-go="pump"]:visible').first().click();await expect(page.locator('[data-ws-screen="pump"]:visible')).toBeVisible();console.log('MASTER_CASE S-04-V THREE_MALFORMED_SIGNED_QR_FORMATS_REJECTED_PASS (expired/revoked signed tokens not tried)');
}});
