import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaLogin,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// FAILED_ONLY_RETRY_158: audit_events.id is bigint, not UUID.
// OILSTATION_QA_BATCH_RUN: only the previously failed 158 is authorized for replay.
const MASTER_UAT_ID='X-07-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-07-H evidence verification',alias:'sales01',role:'platform_sales',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
const r=await page.request.get(BASE+'/api/platform/sales/activity?stationId='+STATION_A,{headers});expect(r.status()).toBe(200);const a=(await r.json()).result;expect(a.readOnly).toBe(true);expect(a.events.length).toBeGreaterThanOrEqual(1);for(const e of a.events){expect(Number.isSafeInteger(e.id)&&e.id>0).toBe(true);expect(e.who).toBeTruthy();expect(e.what).toBeTruthy();expect(Number.isFinite(Date.parse(e.at))).toBe(true);}const ctx=await page.context().browser().newContext();try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});const other=await qaLogin(p,'sales02','platform_sales','platform');const blocked=await p.request.get(BASE+'/api/platform/sales/activity?stationId='+STATION_A,{headers:other.headers});expect(blocked.status()).toBe(403);expect(await blocked.json()).toEqual({error:'permission_denied'});}finally{await ctx.close();}console.log('MASTER_CASE X-07-H REAL_HISTORIC_AUDIT_EVENT_ACTOR_TIMESTAMP_AND_CROSS_SALES_DENIAL_PASS (old/new snapshots not exposed)');
}});
