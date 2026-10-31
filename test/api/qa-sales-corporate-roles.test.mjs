import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qaVisibleScopes,qaApprovedAlias,createQaAccountsApi} from '../../src/api/qa-accounts.mjs';
const station=[
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 '66666666-6666-4666-8666-666666666666',
 '77777777-7777-4777-8777-777777777777'];
const organization=station.map(x=>x.replace(/^[^\-]+/,'11111111'));
const company=Array.from({length:12},(_,i)=>String(i+10).padStart(8,'0')+'-5555-4555-8555-555555555555');
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:station.join(','),OILSTATION_QA_ORGANIZATION_IDS:organization.join(','),
 OILSTATION_QA_COMPANY_IDS:company.join(',')};
const actor='11111111-1111-4111-8111-111111111111',base='https://oilstation.goldensoft.cloud/api/qa/';
const pass='CompanyQA2026!SecurePass';
const account=(alias,roleCode,scopeId)=>new Request(base+'accounts',{method:'POST',headers:{
 authorization:'Bearer qaSales02','content-type':'application/json',origin:'https://oilstation.goldensoft.cloud'},
 body:JSON.stringify({alias,password:pass,scopeType:'corporate_company',scopeId,roleCode})});
const handler=()=>{
 const creates=[];
 const db={
  memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}],
  qaSalesScopes:async()=>({station:station.slice(2),organization:organization.slice(2)}),
  qaSalesCorporateScopes:async()=>company.slice(6),
  qaScopedOptions:async()=>({
   platform:[],organization:organization.map(id=>({id,name:'QA Org'})),
   station:station.map(id=>({id,name:'QA Station'})),
   corporate_company:company.map(id=>({id,name:'QA Company'}))})
 };
 const handle=createQaAccountsApi({env,authenticate:async()=>({id:actor,isQa:true}),db,
  provisionAccount:async input=>{creates.push(input);return {id:'qa-user',alias:input.alias}},
  resetQaPassword:async()=>true});
 return {handle,creates};
};
test('Sales02 can view only C07-C12 and global QA alias numbering remains frozen',async()=>{
 const x=handler();const res=await x.handle(new Request(base+'scopes',{headers:{authorization:'Bearer qaSales02'}}));
 assert.equal(res.status,200);
 const scopes=(await res.json()).scopes;
 assert.deepEqual(scopes.corporate_company.map(x=>x.id),company.slice(6));
 assert.deepEqual(scopes.corporate_company.map(x=>x.aliasPrefix),['c07','c08','c09','c10','c11','c12']);
 assert.deepEqual(scopes.station.map(x=>x.id),station.slice(2));
 assert.deepEqual(scopes.platform,[]);
});
test('Sales02 may provision own 30 Corporate users but never C01-C06, platform role or reset',async()=>{
 const x=handler();
 for(let i=6;i<12;i++){
  for(const [role,suffix] of [
   ['corporate_admin','admin'],['coupon_issuer','issuer'],
   ['accountant','accountant'],['finance_manager','finance'],['driver','driver']
  ]){
   const alias='c'+String(i+1).padStart(2,'0')+'-'+suffix;
   const res=await x.handle(account(alias,role,company[i]));
   assert.equal(res.status,201,alias);
  }
 }
 assert.equal(x.creates.length,30);
 assert.equal((await x.handle(account('c01-admin','corporate_admin',company[0]))).status,403);
 assert.equal((await x.handle(account('c06-driver','driver',company[5]))).status,403);
 assert.equal((await x.handle(account('c12-admin','corporate_admin',company[0]))).status,400);
 assert.equal((await x.handle(new Request(base+'reset-password',{method:'POST',headers:{
 authorization:'Bearer qaSales02','content-type':'application/json',origin:'https://oilstation.goldensoft.cloud'},
 body:JSON.stringify({alias:'c07-admin',password:pass})}))).status,403);
 assert.equal(x.creates.length,30);
});
test('SQL and configuration pin Corporate role scopes to originally sold and still assigned stations',()=>{
 const sql=readFileSync('supabase/migrations/20261031200000_qa_sales_corporate_role_scopes.sql','utf8');
 for(const string of ["p_scope_type='corporate_company'",
  "SELECT 1 FROM public.corporate_station_accounts",
  "NOT public.oilstation_sales_owns_scope(p_actor_id,'station',a.station_id)",
  "cardinality(p_company_ids) IS DISTINCT FROM 12",
  "c.name=v_expected","a.station_id=p_station_ids[v_station_idx]",
  "public.oilstation_qa_sales_corporate_scopes",
  "('organization','station','corporate_company')",
  "REVOKE ALL ON FUNCTION","TO service_role"])
  assert.ok(sql.includes(string),string);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|GRANT SELECT ON TABLE|GRANT INSERT ON TABLE/i);
 const main=readFileSync('src/client/qa-accounts.js','utf8');
 assert.match(main,/corporate_company:'บริษัทลูกค้าของปั๊ม'/);
 const adapter=readFileSync('src/adapters/supabase.mjs','utf8');
 assert.match(adapter,/rpc\/oilstation_qa_sales_corporate_scopes/);
 assert.match(adapter,/p_company_ids:allowed\.corporate_company/);
});
test('Sales QA Corporate alias suffix cannot impersonate another company or role',()=>{
 const allow={corporate_company:company};
 assert.equal(qaApprovedAlias({alias:'c07-admin',scopeType:'corporate_company',
  roleCode:'corporate_admin',scopeId:company[6]},allow),true);
 assert.equal(qaApprovedAlias({alias:'c12-driver',scopeType:'corporate_company',
  roleCode:'driver',scopeId:company[11]},allow),true);
 assert.equal(qaApprovedAlias({alias:'c07-admin',scopeType:'corporate_company',
  roleCode:'corporate_admin',scopeId:company[0]},allow),false);
});
