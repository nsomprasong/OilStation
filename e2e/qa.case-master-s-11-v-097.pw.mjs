import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='S-11-V';
masterCase({id:MASTER_UAT_ID,description:'invalid-company-terms-rejected-before-creation',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
check:async({page,headers,expect,BASE})=>{
const endpoint=BASE+'/api/station/customer-overview?stationId='+STATION_B;
const first=await page.request.get(endpoint,{headers});expect(first.status()).toBe(200);
const before=(await first.json()).accounts;expect(before).toHaveLength(3);
const badTerms=[
 {paymentTermsDays:30,dueMode:'statement',statementCloseDay:32},
 {paymentTermsDays:-1,dueMode:'per_fill',statementCloseDay:null},
 {paymentTermsDays:45,dueMode:'invalid',statementCloseDay:null}
];
for(const term of badTerms){
 const body={stationId:STATION_B,name:'QA-S01-B-C01',
 contactEmail:'qa-c04-admin@qa.oilstation.invalid',taxId:null,...term};
 const resp=await page.request.post(BASE+'/api/station/customers',{
  headers:{...headers,origin:BASE,'content-type':'application/json'},data:body});
 expect(resp.status()).toBe(400);
 expect(await resp.json()).toEqual({error:'qa_fixture_only'});
}
const last=await page.request.get(endpoint,{headers});expect(last.status()).toBe(200);
expect((await last.json()).accounts).toEqual(before);
console.log('MASTER_CASE S-11-V INVALID_QA_CREDIT_DUE_FIELDS_BLOCKED_NO_CUSTOMER_WRITE_PASS; actual credit ceiling below outstanding still pending');
}});
