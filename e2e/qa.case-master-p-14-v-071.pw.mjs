import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='P-14-V';
masterCase({id:MASTER_UAT_ID,description:'malformed-audit-cursor-and-duplicate-params-rejected',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const candidates=[
 '/api/platform/sales/activity?stationId='+STATION_A+'&before=not-a-timestamp',
 '/api/platform/sales/activity?stationId='+STATION_A+'&before=2026-02-30T00:00:00.000Z',
 '/api/platform/sales/activity?stationId='+STATION_A+'&stationId='+STATION_A,
 '/api/platform/sales/activity?stationId='+STATION_A+'&unapproved=1'
];
for(const path of candidates){
 const res=await page.request.get(BASE+path,{headers});
 expect(res.status(),'invalid audit search filter must be denied').toBe(400);
 expect(await res.json()).toEqual({error:'invalid_inspection'});
}
console.log('MASTER_CASE P-14-V INVALID_TIMESTAMP_DUPLICATE_OR_UNKNOWN_AUDIT_FILTER_DENIED_PASS');
}});
