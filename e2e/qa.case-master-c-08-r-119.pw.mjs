import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected new Master test.
const MASTER_UAT_ID='C-08-R';
masterCase({id:MASTER_UAT_ID,description:'bounded C-08-R role/credit read guard',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(own.status()).toBe(200);const denied=await page.request.get(BASE+'/api/my-accounts/07de207d-97cd-4f46-9683-d431d057c583/fuels',{headers});expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});const roster=await page.request.get(BASE+'/api/corporate/drivers?companyId='+COMPANY_C01,{headers});expect(roster.status()).toBe(403);expect(await roster.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE C-08-R DRIVER_INBOX_ALLOWED_ISSUER_FUEL_SELECTOR_AND_DRIVER_ADMIN_DENIED_PASS');
}});
