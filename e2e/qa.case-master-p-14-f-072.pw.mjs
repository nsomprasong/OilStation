import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='P-14-F';
masterCase({id:MASTER_UAT_ID,description:'audit-history-cursor-pagination-chronology',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const endpoint=BASE+'/api/platform/sales/activity?stationId='+STATION_A;
const res=await page.request.get(endpoint,{headers});expect(res.status()).toBe(200);
const body=(await res.json()).result;
expect(body.readOnly).toBe(true);expect(body.stationId).toBe(STATION_A);
expect(Array.isArray(body.events)).toBe(true);
const events=body.events;expect(events.length).toBeGreaterThan(0);expect(events.length).toBeLessThanOrEqual(50);
for(let i=1;i<events.length;i++)expect(Date.parse(events[i].at)).toBeLessThanOrEqual(Date.parse(events[i-1].at));
const before=new Date(events[0].at).toISOString();
const older=await page.request.get(endpoint+'&before='+encodeURIComponent(before),{headers});
expect(older.status()).toBe(200);const olderEvents=(await older.json()).result.events;
expect(Array.isArray(olderEvents)).toBe(true);expect(olderEvents.length).toBeLessThanOrEqual(50);
for(const e of olderEvents)expect(Date.parse(e.at)).toBeLessThan(Date.parse(before));
const repeat=await page.request.get(endpoint+'&before='+encodeURIComponent(before),{headers});
expect(repeat.status()).toBe(200);expect((await repeat.json()).result.events).toEqual(olderEvents);
console.log('MASTER_CASE P-14-F AUDIT_CHRONOLOGY_CURSOR_BEFORE_REPEAT_READONLY_PASS');
}});
