import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='X-04-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-04-R QA evidence',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const snapshot=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(snapshot.status()).toBe(200);const original=await snapshot.json();const body={companyId:COMPANY_C01,driverUserId:'00000000-0000-4000-8000-000000000146',plate:'QA-146'};for(let i=0;i<2;i++){const req=await page.request.post(BASE+'/api/corporate/driver-vehicle',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:body});expect(req.status()).toBe(403);expect(await req.json()).toEqual({error:'permission_denied'});}const same=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(same.status()).toBe(200);expect(await same.json()).toEqual(original);console.log('MASTER_CASE X-04-R REPLAYED_UNAUTHORIZED_DRIVER_ASSIGNMENT_REJECTED_TWICE_WITH_NO_STATE_CHANGE_PASS (authorized idempotency remains untested)');
}});
