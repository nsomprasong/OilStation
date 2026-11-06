import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// FAILED_ONLY_RECOVERY_20261106
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='C-10-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded C-10-R authorized scope',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).vehicles)).toBe(true);const pending=await page.request.get(BASE+'/api/qa/finance/topup/pending?stationId='+STATION_A,{headers});expect(pending.status()).toBe(403);expect(await pending.json()).toEqual({error:'permission_denied'});const banks=await page.request.get(BASE+'/api/topup/banks?accountId=07de207d-97cd-4f46-9683-d431d057c583',{headers});expect(banks.status()).toBe(403);expect(await banks.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE C-10-R DRIVER_CAN_VIEW_QR_NOT_TOPUP_APPROVAL_OR_BANK_PAYMENT_INFO_PASS');
}});
