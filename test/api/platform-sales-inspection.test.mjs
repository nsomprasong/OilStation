import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlatformSalesApi} from '../../src/api/platform-sales.mjs';
import {mountSalesInspection,mountSalesActivity} from '../../src/client/platform-sales-readonly.js';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const U='https://oilstation.goldensoft.cloud/api/platform/sales/';
const ACTOR='11111111-1111-4111-8111-111111111111',STATION='22222222-2222-4222-8222-222222222222',COMPANY='33333333-3333-4333-8333-333333333333';
const get=(route,auth=true)=>new Request(U+route,{headers:auth?{authorization:'Bearer valid'}:{}});
const api=db=>createPlatformSalesApi({authenticate:async()=>({id:ACTOR}),db});
const file=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('station/customer inspection requires bearer and valid scoped UUIDs',async()=>{
 const seen=[];const handle=api({platformSalesInspection:async d=>{seen.push(d);return {readOnly:true,companies:[],vehicles:[]};}});
 assert.equal((await handle(get('inspection?stationId='+STATION))).status,200);
 assert.deepEqual(seen[0],{actorId:ACTOR,stationId:STATION,companyId:null});
 assert.equal((await handle(get('inspection?stationId='+STATION+'&companyId='+COMPANY))).status,200);
 assert.deepEqual(seen[1],{actorId:ACTOR,stationId:STATION,companyId:COMPANY});
 for(const url of ['inspection','inspection?stationId=bad','inspection?stationId='+STATION+'&companyId=bad',
  'inspection?stationId='+STATION+'&operation=edit','inspection?stationId='+STATION+'&stationId='+STATION]){
  assert.equal((await handle(get(url))).status,400,url);
 }
 assert.equal((await handle(get('inspection?stationId='+STATION,false))).status,401);
 assert.equal((await handle(new Request(U+'inspection?stationId='+STATION,{method:'POST',headers:{authorization:'Bearer valid'}}))).status,405);
 assert.equal(seen.length,2);
});
test('activity history uses authorized station only and strictly validated cursor',async()=>{
 const seen=[];const handle=api({platformSalesActivity:async d=>{seen.push(d);return {events:[],readOnly:true};}});
 assert.equal((await handle(get('activity?stationId='+STATION))).status,200);
 const before='2026-10-30T12:34:56.000Z';
 assert.equal((await handle(get('activity?stationId='+STATION+'&before='+encodeURIComponent(before)))).status,200);
 assert.deepEqual(seen[1],{actorId:ACTOR,stationId:STATION,before});
 for(const bad of ['activity?stationId=bad','activity?stationId='+STATION+'&before=tomorrow',
   'activity?stationId='+STATION+'&before=2026-02-30T00:00:00.000Z',
   'activity?stationId='+STATION+'&before='+encodeURIComponent(before)+'&companyId='+COMPANY]){
  assert.equal((await handle(get(bad))).status,400,bad);
 }
 assert.equal(seen.length,2);
});
test('forbidden sales representative cannot retrieve station, company or audit entries',async()=>{
 const handle=api({platformSalesInspection:async()=>{throw {code:'FORBIDDEN'};},
  platformSalesActivity:async()=>{throw {code:'FORBIDDEN'};}});
 for(const route of ['inspection','activity'])
  assert.equal((await handle(get(route+'?stationId='+STATION))).status,403);
});
test('SQL limits Sales to ACTIVE current assignments, linked companies and allowlisted audit actions',()=>{
 const sql=file('supabase/migrations/20261031140000_sales_operational_readonly.sql');
 for(const needed of [
  'platform_sales_station_inspection','platform_sales_activity_history',
  "m.role_code='platform_sales'","a.effective_from<=clock_timestamp()",
  "a.effective_until>clock_timestamp()","a.station_id=p_station_id",
  'corporate_station_accounts','c.id=p_company_id','audit_events',
  'e.station_id=p_station_id','LIMIT 50','readOnly',
  'SET search_path=','REVOKE ALL ON FUNCTION','TO service_role'
 ])assert.ok(sql.includes(needed),needed);
 for(const forbidden of ['prepaid_balance_satang','debt_outstanding_satang',
  'credit_limit_satang','before_state,','after_state,',
  'INSERT INTO public.','UPDATE public.','DELETE FROM public.']){
  assert.ok(!sql.includes(forbidden),forbidden);
 }
});
test('Sales inspection is not impersonation and displays no financial controls',()=>{
 assert.equal(typeof mountSalesInspection,'function');
 assert.equal(typeof mountSalesActivity,'function');
 const code=file('src/client/platform-sales-readonly.js');
 assert.match(code,/readOnly|อ่านอย่างเดียว/);
 assert.match(code,/openStation/);
 assert.match(code,/companyId/);
 assert.match(code,/data\.companies/);
 assert.match(code,/data\.vehicles/);
 assert.match(code,/document\.createElement/);
 assert.doesNotMatch(code,/innerHTML|payment-intent|billing\/payment|service_role|creditLimit|prepaidBalance/);
 const main=file('src/client/main.js');
 assert.match(main,/register\('activity'/);
 const screens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_sales'}]).map(s=>s.key);
 assert.deepEqual(screens,['overview','sales','activity','stations']);
 assert.doesNotMatch(JSON.stringify(screens),/billing|finance/);
});
test('audit is dense 3-column table with compact mobile rows and no raw JSON diff',()=>{
 const src=file('src/client/platform-sales-readonly.js');
 for(const h of ['ใคร','ทำอะไร','เมื่อไร'])assert.ok(src.includes("'"+h+"'"));
 assert.match(src,/node\('table','os-activity-table'\)/);
 assert.doesNotMatch(src,/before_state|after_state/);
 const css=file('public/platform-sales-readonly.css');
 for(const rule of ['table-layout:fixed','border-collapse:collapse','@media(max-width:620px)','padding:7px 6px','font-size:11px'])
  assert.ok(css.includes(rule),rule);
 assert.match(file('index.html'),/platform-sales-readonly\.css/);
});
