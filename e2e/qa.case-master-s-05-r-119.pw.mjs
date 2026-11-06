import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-05-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-05-R tenant denied action',alias:'c01-issuer',role:'coupon_issuer',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/my-accounts/07de207d-97cd-4f46-9683-d431d057c583/fuels',{headers});expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).fuels)).toBe(true);const forbidden=await page.request.get(BASE+'/api/my-accounts/e42cf203-bd1e-43b4-b5bf-18b262b838ab/fuels',{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE S-05-R FOREIGN_COMPANY_ACCOUNT_CANNOT_ENTER_ISSUER_FUEL_SELECTION_PASS (reserve attempt intentionally not sent)');
}});
