import {masterCase,STATION_A,STATION_B,STATION_S02A,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='P-12-R';
masterCase({id:MASTER_UAT_ID,description:'sales-commission-summary-is-self-only',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const res=await page.request.get(BASE+'/api/platform/sales/workspace',{headers});
expect(res.status()).toBe(200);const data=(await res.json()).result;
expect(data.isAdmin).toBe(false);
expect(data.people).toHaveLength(1);
const ownUser=data.people[0].id;
const ownStations=new Set([STATION_A,STATION_B]);
const otherStations=new Set([STATION_S02A,STATION_S02B]);
expect(data.assignments).toHaveLength(2);
for(const a of data.assignments){expect(a.salesId).toBe(ownUser);expect(ownStations.has(a.stationId)).toBe(true);expect(otherStations.has(a.stationId)).toBe(false);}
for(const c of data.commissions||[]){expect(c.salesId).toBe(ownUser);expect(otherStations.has(c.stationId)).toBe(false);}
for(const c of data.collectedCustomers||[]){expect(c.salesId).toBe(ownUser);expect(otherStations.has(c.stationId)).toBe(false);}
console.log('MASTER_CASE P-12-R SELF_ONLY_COMMISSION_ASSIGNMENTS_AND_COLLECTED_CUSTOMERS_PASS');
}});
