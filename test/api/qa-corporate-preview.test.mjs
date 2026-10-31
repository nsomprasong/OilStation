import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQaCorporatePreviewApi} from '../../src/api/qa-corporate-preview.mjs';

const stations=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',
 '66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777'];
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:stations.join(',')};
const url='https://oilstation.goldensoft.cloud/api/station/customers';
const role=(id)=>({active:true,scope_type:'station',station_id:id,role_code:'station_owner'});
const payload=(i=0,slot=1)=>({
 stationId:stations[i],name:['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'][i]+'-C0'+slot,
 contactEmail:'qa-c'+String(i*3+slot).padStart(2,'0')+'-admin@qa.oilstation.invalid',
 taxId:null,paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null,
});
const post=(body,opts={})=>new Request(url,{method:opts.method||'POST',headers:{
  authorization:opts.bearer===false?'':'Bearer eyJhbGciOiJIUzI1NiJ9.aabbccddeeff.zzzxxyyww',
  origin:opts.origin||'https://oilstation.goldensoft.cloud',
  'content-type':'application/json'},body:JSON.stringify(body)});
const app=(config={})=>{
 const calls=[];
 return {calls,route:createQaCorporatePreviewApi({
  env:config.env||env,
  authenticate:config.authenticate||(async()=>({id:'11111111-1111-4111-8111-111111111111',isQa:true})),
  db:{memberships:config.memberships||(async()=>[role(stations[0])]),
   qaCreateCorporateCustomer:async arg=>{calls.push(arg);return {companyId:'safe-company',name:arg.name};}},
 })};
};
test('only logged in approved station owner may create precisely QA-C01 at first station',async()=>{
 const a=app();
 const response=await a.route(post(payload()));
 assert.equal(response.status,201);
 assert.equal(a.calls.length,1);
 assert.equal(a.calls[0].stationId,stations[0]);
 assert.equal(a.calls[0].qaRunId,'QA-20261031-PLATFORM-001');
 assert.deepEqual(a.calls[0].stationIds,stations);
});
test('cross-station owner, fake qa name, wrong credit and wrong email rejected without writes',async()=>{
 const a=app();
 const cross=await a.route(post(payload(2,1)));
 assert.equal(cross.status,403);
 for(const d of [
  {...payload(),name:'Real customer'},
  {...payload(),name:'QA-S01-A-C04'},
  {...payload(),contactEmail:'real@company.com'},
  {...payload(),paymentTermsDays:30},
  {...payload(),creditLimit:1000,paymentTermsDays:30},
  {...payload(),taxId:'1111111111111'},
  {...payload(),dueMode:'statement'},
 ]){
  assert.equal((await a.route(post(d))).status,400);
 }
 assert.equal(a.calls.length,0);
});
test('only synthetic QA actor can use tightly scoped preview while finance remains off',async()=>{
 assert.equal((await app({authenticate:async()=>null}).route(post(payload()))).status,403);
 assert.equal((await app({authenticate:async()=>({id:'user',isQa:false})}).route(post(payload()))).status,403);
 assert.equal((await app({env:{...env,OILSTATION_API_ENABLED:'true'}}).route(post(payload()))).status,404);
 assert.equal((await app({env:{...env,OILSTATION_QA_MODE_ENABLED:'false'}}).route(post(payload()))).status,404);
 assert.equal((await app().route(post(payload(),{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await app().route(post(payload(),{bearer:false}))).status,401);
 assert.equal((await app().route(new Request(url,{method:'GET'}))).status,405);
});
test('SQL must lock synthetic company name, zero balances, bound 4 stations, service-role-only',()=>{
 const sql=readFileSync('supabase/migrations/20261031194000_qa_corporate_zero_balance_onboarding.sql','utf8');
 for(const phrase of [
  'public.oilstation_qa_station_create_company',
  "v_station_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B']",
  "raw_app_meta_data->>'oilstation_qa_run_id'",
  "m.role_code IN ('station_owner','owner')",
  "pg_catalog.pg_advisory_xact_lock",
  "a.prepaid_balance_satang<>0",
  "a.credit_limit_satang<>0",
  "a.debt_outstanding_satang<>0",
  "a.reserved_satang<>0",
  "public.station_create_corporate_customer(",
  "p_actor_id,p_station_id,p_name,NULL,v_email,0,'per_fill',NULL",
  'REVOKE ALL ON FUNCTION','FROM PUBLIC,anon,authenticated','TO service_role'
 ])assert.ok(sql.includes(phrase),phrase);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|UPDATE|INSERT|DELETE|ALL) ON TABLE|TRUNCATE|DROP TABLE/i);
 const worker=readFileSync('src/worker.mjs','utf8');
 assert.match(worker,/url\.pathname==='\/api\/station\/customers' && qaIsEnabled\(env\)/);
 assert.match(worker,/createQaCorporatePreviewApi/);
 assert.ok(worker.includes("if (env.OILSTATION_API_ENABLED!=='true')"));
});
