import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN new only; no accepted writes.
const MASTER_UAT_ID='S-11-V';
masterCase({id:MASTER_UAT_ID,description:'bounded S-11-V role and validation acceptance',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const before=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(before.status()).toBe(200);const rows=(await before.json()).accounts;expect(rows.length).toBe(3);for(const [terms,day] of [[-1,15],[366,15],[30,32]]){const bad=await page.request.post(BASE+'/api/station/customers',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,name:'QA NEVER CREATE TERM INVALID',paymentTermsDays:terms,dueMode:'statement',statementCloseDay:day}});expect(bad.status()).toBe(400);expect(await bad.json()).toEqual({error:'invalid_customer'});}const after=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(after.status()).toBe(200);expect((await after.json()).accounts).toEqual(rows);console.log('MASTER_CASE S-11-V INVALID_CREDIT_TERMS_AND_STATEMENT_CLOSE_DAY_400_NO_COMPANY_WRITE_PASS');
}});
