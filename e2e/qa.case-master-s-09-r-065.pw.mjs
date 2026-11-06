import {masterCase,STATION_B,STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='S-09-R';
masterCase({id:MASTER_UAT_ID,description:'cross-station-customer-create-denied',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const ownerBefore=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(ownerBefore.status()).toBe(200);
const ownerSnapshot=await ownerBefore.json();
const denied=await page.request.post(BASE+'/api/station/customers',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_S02A,name:'QA-S02-A-C01',contactEmail:'qa-c07-admin@qa.oilstation.invalid',taxId:null,paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null}});
expect(denied.status(),'s01b owner must not create customer for s02a').toBe(403);
expect(await denied.json()).toEqual({error:'scope_not_owned'});
const ownerAfter=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(ownerAfter.status()).toBe(200);
expect(await ownerAfter.json()).toEqual(ownerSnapshot);
console.log('MASTER_CASE S-09-R CROSS_STATION_CUSTOMER_CREATE_DENIED_PASS');
}});
