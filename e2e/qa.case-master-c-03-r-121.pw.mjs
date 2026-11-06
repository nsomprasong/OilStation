import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected new Master test.
const MASTER_UAT_ID='C-03-R';
masterCase({id:MASTER_UAT_ID,description:'bounded C-03-R role/credit read guard',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const c02='7f3dae09-5ff4-409c-bdf8-049086f99b7a';const mine=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'corporate_company',scopeId:COMPANY_C01}),{headers});expect(mine.status()).toBe(200);expect(Array.isArray((await mine.json()).members)).toBe(true);const bad=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'corporate_company',scopeId:c02}),{headers});expect(bad.status()).toBe(403);expect(await bad.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE C-03-R CROSS_COMPANY_MEMBERSHIP_PROFILE_DATA_ACCESS_DENIED_PASS (edit action not issued)');
}});
