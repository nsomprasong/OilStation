import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-04-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-04-R tenant denied action',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const invalidButWellShaped='00000000-0000-4000-8000-000000000000.'+'0'.repeat(64);const denied=await page.request.post(BASE+'/api/station/scan-qr',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{qrPayload:invalidButWellShaped}});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'qa_station_only'});expect(await page.locator('[data-ws-screen="pump"]').count()).toBe(0);console.log('MASTER_CASE S-04-R CORPORATE_ADMIN_CANNOT_USE_STATION_QR_SCANNER_API_PASS (foreign station signed token variant unproven)');
}});
