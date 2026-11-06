import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded new Master case only.
const MASTER_UAT_ID='S-04-R';
masterCase({id:MASTER_UAT_ID,description:'bounded S-04-R new safe QA acceptance',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const accounts=await page.request.get(BASE+'/api/my-accounts',{headers});expect(accounts.status()).toBe(200);expect((await accounts.json()).accounts.length).toBeGreaterThan(0);const signed='00000000-0000-4000-8000-000000000000.'+'0'.repeat(64);const forbidden=await page.request.post(BASE+'/api/station/scan-qr',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{qrPayload:signed}});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'qa_station_only'});expect(await page.locator('[data-ws-screen="pump"]').count()).toBe(0);console.log('MASTER_CASE S-04-R CORPORATE_ADMIN_CANNOT_SCAN_STATION_SIGNED_QR_403_PASS (actual wrong-station operator scan remains gated)');
}});
