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
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:station.join(','),OILSTATION_QA_ORGANIZATION_IDS:organization.join(','),
 OILSTATION_QA_COMPANY_IDS:company.join(',')};
const actor='11111111-1111-4111-8111-111111111111';
const base='https://oilstation.goldensoft.cloud/api/qa/';
const pw='CompanyQA2026!SecurePass';
const roles={
 sales:{scope_type:'platform',role_code:'platform_sales'},
 station:{scope_type:'station',role_code:'station_owner',station_id:station[0]},
 company:{scope_type:'corporate_company',role_code:'corporate_admin',corporate_company_id:company[0]},
 org:{scope_type:'organization',role_code:'organization_owner',organization_id:organization[0]},
};
const request=(path,body)=>new Request(base+path,{method:'POST',headers:{
 authorization:'Bearer qa','content-type':'application/json',origin:'https://oilstation.goldensoft.cloud'},
 body:JSON.stringify(body)});
const account=(alias,roleCode,scopeType,scopeId)=>({alias,password:pw,roleCode,scopeType,scopeId});
const create=(role)=>{
 const calls=[];
 const db={
  memberships:async()=>[{...roles[role],active:true}],
  qaAdminCompanyScopes:async()=>company.slice(0,3),
  qaScopedOptions:async()=>({
   platform:[],organization:organization.map(id=>({id,name:'QA Org'})),
   station:station.map(id=>({id,name:'QA Station'})),
   corporate_company:company.map(id=>({id,name:'QA Company'})),
  }),
 };
 const api=createQaAccountsApi({env,authenticate:async()=>({id:actor,isQa:true}),db,
  provisionAccount:async data=>{calls.push(data);return {id:'qa-created',alias:data.alias}},
  resetQaPassword:async()=>true});
 return {api,calls};
};
test('Sales cannot create employee, initial company admin, or even enumerate subordinate QA account scopes',async()=>{
 const x=create('sales');
 assert.equal((await x.api(new Request(base+'scopes',{headers:{authorization:'Bearer qa'}}))).status,403);
 assert.equal((await x.api(request('accounts',account('c01-admin','corporate_admin','corporate_company',company[0])))).status,403);
 assert.equal((await x.api(request('accounts',account('s01a-cashier','cashier','station',station[0])))).status,403);
 assert.equal(x.calls.length,0);
});
test('station owner can bootstrap own company first admin and add own station staff, never other staff/company',async()=>{
 const x=create('station');
 const r=await x.api(new Request(base+'scopes',{headers:{authorization:'Bearer qa'}}));
 assert.equal(r.status,200);
 const scopes=(await r.json()).scopes;
 assert.deepEqual(scopes.station.map(x=>x.id),[station[0]]);
 assert.deepEqual(scopes.corporate_company.map(x=>x.id),company.slice(0,3));
 for(const params of [
  ['c01-admin','corporate_admin','corporate_company',company[0]],
  ['s01a-cashier','cashier','station',station[0]],
 ]){
  assert.equal((await x.api(request('accounts',account(...params)))).status,201,params[0]);
 }
 for(const params of [
  ['c01-driver','driver','corporate_company',company[0]],
  ['c07-admin','corporate_admin','corporate_company',company[6]],
  ['s01b-cashier','cashier','station',station[1]],
  ['s01a-owner','station_owner','station',station[0]],
 ]){
  assert.equal((await x.api(request('accounts',account(...params)))).status,403,params[0]);
 }
 assert.equal(x.calls.length,2);
});
test('Corporate Admin creates only own corporate staff; no bootstrap, no Sales, no foreign-company driver',async()=>{
 const x=create('company');
 const r=await x.api(new Request(base+'scopes',{headers:{authorization:'Bearer qa'}}));
 const scopes=(await r.json()).scopes;
 assert.deepEqual(scopes.corporate_company.map(x=>x.id),[company[0]]);
 assert.deepEqual(scopes.station,[]);
 for(const [role,suffix] of [
  ['coupon_issuer','issuer'],['accountant','accountant'],
  ['finance_manager','finance'],['driver','driver']
 ]){
  const res=await x.api(request('accounts',account('c01-'+suffix,role,'corporate_company',company[0])));
  assert.equal(res.status,201,role);
 }
 for(const params of [
  ['c01-admin','corporate_admin','corporate_company',company[0]],
  ['c02-driver','driver','corporate_company',company[1]],
  ['s01a-cashier','cashier','station',station[0]],
  ['sales01','platform_sales','platform',null],
 ])assert.equal((await x.api(request('accounts',account(...params)))).status,403,params[0]);
 assert.equal(x.calls.length,4);
});
test('organization owner creates only own billing staff',async()=>{
 const x=create('org');
 assert.equal((await x.api(request('accounts',
  account('o01-billing','billing_manager','organization',organization[0])))).status,201);
 assert.equal((await x.api(request('accounts',
  account('o01-owner','organization_owner','organization',organization[0])))).status,403);
 assert.equal((await x.api(request('accounts',
  account('o02-billing','billing_manager','organization',organization[1])))).status,403);
});
test('SQL checks active matching admin scopes and service-only RPC; no Sales personnel grant',()=>{
 const sql=readFileSync('supabase/migrations/20261031223000_qa_admin_owned_staff_and_company_bootstrap.sql','utf8');
 for(const term of ["p_role_code='corporate_admin'","m.role_code='station_owner'",
  "m.role_code='corporate_admin'","p_role_code IN ('coupon_issuer','accountant','finance_manager','driver')",
  "public.oilstation_qa_admin_company_scopes","public.platform_qa_register_account",
  'REVOKE ALL ON FUNCTION','TO service_role',
  "AND p_role_code='station_owner'","AND p_role_code='organization_owner'"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/v_allowed:=v_platform_admin OR v_sales_owns_station OR EXISTS/);
 assert.doesNotMatch(sql,/v_allowed:=v_platform_admin OR v_sales_owns_org OR EXISTS/);
 const main=readFileSync('src/client/main.js','utf8');
 assert.ok(!main.includes('mountQaAccountsAdmin({target:host,token:session.access_token,salesMode:true})'));
 assert.match(main,/mode:'station_owner'/);
 assert.match(main,/mode:'corporate_admin'/);
 const adapter=readFileSync('src/adapters/supabase.mjs','utf8');
 assert.match(adapter,/rpc\/oilstation_qa_admin_company_scopes/);
});
test('global alias numbering remains frozen for only one company',()=>{
 const visible=qaVisibleScopes({platform:[],station:station.map(id=>({id})),
  organization:[],corporate_company:company.map(id=>({id}))},
  {platform:[],station:[station[0]],organization:[],corporate_company:[company[6]]});
 assert.deepEqual(visible.corporate_company.map(x=>x.aliasPrefix),['c07']);
 const allow={corporate_company:company};
 assert.equal(qaApprovedAlias({alias:'c07-driver',scopeType:'corporate_company',
  roleCode:'driver',scopeId:company[6]},allow),true);
 assert.equal(qaApprovedAlias({alias:'c07-driver',scopeType:'corporate_company',
  roleCode:'driver',scopeId:company[0]},allow),false);
});
