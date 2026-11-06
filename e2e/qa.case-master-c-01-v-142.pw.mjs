import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='C-01-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded C-01-V QA evidence',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
for(const path of ['/api/me','/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_A})]){const anonymous=await page.request.get(BASE+path);expect(anonymous.status(),path).toBe(401);}const own=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(own.status()).toBe(200);const forbidden=await page.request.get(BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION_A}),{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE C-01-V UNAUTHENTICATED_401_AND_DRIVER_WITHOUT_STATION_MEMBERSHIP_403_PASS (disabled/unverified account state not exercised)');
}});
