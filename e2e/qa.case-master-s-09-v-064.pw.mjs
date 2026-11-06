import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='S-09-V';
masterCase({id:MASTER_UAT_ID,description:'fourth-fixture-company-rejected',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const url=BASE+'/api/station/customer-overview?stationId='+STATION_B;
const before=await page.request.get(url,{headers});expect(before.status()).toBe(200);
const original=(await before.json()).accounts;expect(original).toHaveLength(3);
const denied=await page.request.post(BASE+'/api/station/customers',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_B,name:'QA-S01-B-C04',contactEmail:'qa-c04-admin@qa.oilstation.invalid',taxId:null,paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null}});
expect(denied.status(),'fourth QA corporate company must not be created').toBe(400);
expect(await denied.json()).toEqual({error:'qa_fixture_only'});
const after=await page.request.get(url,{headers});expect(after.status()).toBe(200);
expect((await after.json()).accounts).toEqual(original);
console.log('MASTER_CASE S-09-V FOURTH_QA_COMPANY_REJECTED_AND_REMAIN_THREE_PASS');
}});
