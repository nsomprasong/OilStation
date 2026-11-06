import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded new Master case only.
const MASTER_UAT_ID='C-02-V';
masterCase({id:MASTER_UAT_ID,description:'bounded C-02-V new safe QA acceptance',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const url=BASE+'/api/station/customer-overview?stationId='+STATION_A;const before=await page.request.get(url,{headers});expect(before.status()).toBe(200);const accounts=(await before.json()).accounts;expect(accounts).toHaveLength(3);const denied=await page.request.post(BASE+'/api/station/customers',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,name:'QA-S01-A-C04',contactEmail:'qa-c04-admin@qa.oilstation.invalid',taxId:null,paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null}});expect(denied.status()).toBe(400);expect(await denied.json()).toEqual({error:'qa_fixture_only'});const after=await page.request.get(url,{headers});expect(after.status()).toBe(200);expect((await after.json()).accounts).toEqual(accounts);console.log('MASTER_CASE C-02-V THIRTEENTH_QA_COMPANY_DENIED_NO_NEW_CUSTOMER_PASS');
}});
