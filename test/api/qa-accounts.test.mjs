import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQaAccountsApi,qaIsEnabled,qaApprovedAlias} from '../../src/api/qa-accounts.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const stationA='22222222-2222-4222-8222-222222222222';
const stationB='33333333-3333-4333-8333-333333333333';
const stationC='66666666-6666-4666-8666-666666666666';
const stationD='77777777-7777-4777-8777-777777777777';
const stationE='88888888-8888-4888-8888-888888888888';
const stranger='44444444-4444-4444-8444-444444444444';
const company='55555555-5555-4555-8555-555555555555';
const run='QA-20261031-MASTER-001';
const env={
 OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_RUN_ID:run,OILSTATION_QA_STATION_IDS:[stationA,stationB,stationC,stationD].join(','),
 OILSTATION_QA_COMPANY_IDS:company,
};
const db={
 memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_superadmin'}],
 qaScopedOptions:async allowed=>Object.fromEntries(Object.entries(allowed).map(([name,ids])=>[
  name,ids.map(id=>({id,name:'QA '+name})),
 ])),
};
const url='https://oilstation.goldensoft.cloud/api/qa/';
const pw='StrongQaPassword!123456';
const account=(body,options={})=>new Request(url+'accounts',{method:'POST',headers:{
 'content-type':'application/json',authorization:'Bearer good',
 origin:options.origin||'https://oilstation.goldensoft.cloud',
 },body:JSON.stringify(body)});
const body=(alias='sales01',more={})=>({
 alias,password:pw,roleCode:'platform_sales',scopeType:'platform',scopeId:null,...more,
});
const handler=({settings=env,auth=async()=>({id:actor}),memberships=db.memberships,
 provision=async a=>({id:actor,alias:a.alias,roleCode:a.roleCode}),
 reset=async()=>true}={})=>
 createQaAccountsApi({env:settings,authenticate:auth,
  db:{...db,memberships},provisionAccount:provision,resetQaPassword:reset});
test('QA password reset requires authenticated active Super Admin, same origin and strong password',async()=>{
 const called=[];
 const good=handler({reset:async value=>{called.push(value);return true}});
 const req=(alias='sales01',password=pw,origin=url.slice(0,url.indexOf('/api/')))=>
  new Request(url+'reset-password',{method:'POST',headers:{
   authorization:'Bearer good','content-type':'application/json',origin},
   body:JSON.stringify({alias,password}),
  });
 let res=await good(req());
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{alias:'sales01',reset:true});
 assert.equal(called.length,1);
 assert.equal(called[0].qaRunId,run);
 assert.equal(called[0].actorId,actor);
 assert.equal((await good(req('sales01','weak'))).status,400);
 assert.equal((await good(req('sales01',pw,'https://evil.invalid'))).status,403);
 assert.equal((await handler({memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}]})(req())).status,403);
 assert.equal((await handler({reset:async()=>false})(req('sales02'))).status,404);
 assert.equal((await handler({settings:{...env,OILSTATION_QA_MODE_ENABLED:'false'}})(req())).status,404);
});
test('QA login and Admin form are always visible while QA mode is active',()=>{
 const login=readFileSync(new URL('../../src/client/auth-screen.js',import.meta.url),'utf8');
 const admin=readFileSync(new URL('../../src/client/qa-accounts.js',import.meta.url),'utf8');
 assert.ok(login.includes('<section class="os-qa-login"'));
 assert.ok(!login.includes('<details class="os-qa-login"'));
 assert.ok(admin.includes("'/api/qa/reset-password'"));
 assert.ok(admin.includes("'ตั้งรหัสผ่าน QA ใหม่'"));
});
test('QA mode is fail-closed and requires a run id, preview and disabled finance release',()=>{
 for(const delta of [{OILSTATION_QA_MODE_ENABLED:'false'},{OILSTATION_QA_RUN_ID:''},
  {OILSTATION_API_ENABLED:'true'},{OILSTATION_DEPLOY_TARGET:'uat'},
  {OILSTATION_PREVIEW_LOGIN_ENABLED:'false'}]){
  assert.equal(qaIsEnabled({...env,...delta}),false);
 }
 assert.equal(qaIsEnabled(env),true);
});
test('Super Admin can create two Sales accounts without public signup/OTP',async()=>{
 const logged=[];
 const api=handler({provision:async a=>{logged.push(a);return {alias:a.alias}}});
 for(const alias of ['sales01','sales02']){
  const res=await api(account(body(alias)));
  assert.equal(res.status,201);
  assert.equal((await res.json()).account.alias,alias);
 }
 assert.equal(logged.length,2);
 assert.equal(logged[0].qaRunId,run);
 assert.equal(logged[0].actorId,actor);
 assert.equal(logged[0].password,pw);
 assert.equal(logged[0].scopeId,null);
});
test('cannot create a third Sales, new Super Admin, or unapproved scoped station account',async()=>{
 const api=handler();
 assert.equal((await api(account(body('sales03')))).status,400);
 assert.equal((await api(account(body('sales01',{roleCode:'platform_superadmin'})))).status,400);
 assert.equal((await api(account(body('s01a-manager',{roleCode:'manager',scopeType:'station',scopeId:stranger})))).status,403);
 assert.equal((await api(account(body('s01a-manager',{roleCode:'manager',scopeType:'station',scopeId:stationA})))).status,201);
 assert.equal((await api(account(body('c01-admin',{roleCode:'corporate_admin',scopeType:'corporate_company',scopeId:company})))).status,201);
});
test('rejects disabled mode, missing auth, unauthorized role, invalid password and CSRF',async()=>{
 assert.equal((await handler({settings:{...env,OILSTATION_QA_MODE_ENABLED:'false'}})(account(body()))).status,404);
 const api=handler();
 assert.equal((await api(new Request(url+'scopes'))).status,401);
 assert.equal((await handler({memberships:async()=>[{scope_type:'platform',role_code:'platform_sales',active:true}]})(account(body()))).status,403);
 assert.equal((await api(account(body('sales01',{password:'weak'})))).status,400);
 assert.equal((await api(account(body(),{origin:'https://evil.invalid'}))).status,403);
});
test('all QA user options must be inside exact pre-approved scope allowlists',async()=>{
 const api=handler();
 const res=await api(new Request(url+'scopes',{headers:{authorization:'Bearer good'}}));
 assert.equal(res.status,200);
 const scopes=(await res.json()).scopes;
 assert.equal(scopes.station.length,4);
 assert.equal(scopes.corporate_company.length,1);
 const misconfigured=handler({settings:{...env,OILSTATION_QA_STATION_IDS:[stationA,stationB,stationC,stationD,stationE].join(',')}});
 assert.equal((await misconfigured(account(body()))).status,503);
 const companies=Array.from({length:12},(_,i)=>String(i+10).padStart(8,'0')+'-5555-4555-8555-555555555555');
 const twelve=handler({settings:{...env,OILSTATION_QA_COMPANY_IDS:companies.join(',')}});
 const accepted=await twelve(new Request(url+'scopes',{headers:{authorization:'Bearer good'}}));
 assert.equal(accepted.status,200);
 assert.equal((await accepted.json()).scopes.corporate_company.length,12);
 const thirteen=handler({settings:{...env,OILSTATION_QA_COMPANY_IDS:companies.concat('99999999-9999-4999-8999-999999999999').join(',')}});
 assert.equal((await thirteen(account(body()))).status,503);
});
test('per-node QA usernames require matching role and scope, no impersonation',()=>{
 const allowed={organization:[stationA],station:[stationB],corporate_company:[company]};
 const check=(alias,scopeType,scopeId,roleCode)=>qaApprovedAlias({
  alias,scopeType,scopeId,roleCode},allowed);
 assert.equal(check('sales01','platform',null,'platform_sales'),true);
 assert.equal(check('sales02','platform',null,'platform_sales'),true);
 assert.equal(check('support01','platform',null,'platform_support'),true);
 assert.equal(check('support02','platform',null,'platform_support'),false);
 assert.equal(check('o01-owner','organization',stationA,'organization_owner'),true);
 assert.equal(check('s01a-manager','station',stationB,'manager'),true);
 assert.equal(check('s01a-pump','station',stationB,'pump_staff'),true);
 assert.equal(check('c01-accountant','corporate_company',company,'accountant'),true);
 assert.equal(check('c01-driver','corporate_company',company,'driver'),true);
 assert.equal(check('s01b-manager','station',stationB,'manager'),false);
 assert.equal(check('c02-driver','corporate_company',company,'driver'),false);
 assert.equal(check('s01a-owner','station',stationB,'manager'),false);
});
test('new QA users use confirmed Supabase Auth admin user with real membership, never browser service key',()=>{
 const adapter=readFileSync(new URL('../../src/adapters/supabase.mjs',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../src/client/auth-screen.js',import.meta.url),'utf8');
 const plan=readFileSync(new URL('../../docs/qa/plans/2026-10-31-oilstation-master-uat.md',import.meta.url),'utf8');
 const migration=readFileSync(new URL('../../supabase/migrations/20261031153000_qa_account_registration_rpc.sql',import.meta.url),'utf8');
 for(const term of ['auth.admin.createUser','email_confirm:true',
   'oilstation_qa_run_id','auth.admin.deleteUser',
   '/rest/v1/rpc/platform_qa_register_account','user.app_metadata?.oilstation_qa===true'])
  assert.ok(adapter.includes(term),term);
 for(const term of ['public.platform_qa_register_account','public.app_users',
  'public.memberships','public.audit_events','SECURITY DEFINER',
  'TO service_role','REVOKE ALL ON FUNCTION','INVALID_QA_IDENTITY'])
  assert.ok(migration.includes(term),term);
 assert.ok(!migration.includes('GRANT INSERT ON public.app_users'));
 assert.ok(!adapter.includes("serviceRequest(env,'/rest/v1/app_users'"));
 assert.ok(worker.includes('qaIsEnabled(env)'));
 assert.ok(client.includes('signInWithPassword'));
 assert.ok(html.includes('qaMode&&!setup&&!invited'));
 assert.match(plan,/Exactly four QA stations/);
 assert.match(plan,/Exactly two QA platform Sales accounts/);
 assert.doesNotMatch(worker,/OILSTATION_QA_MODE_ENABLED\s*=\s*'true'/);
});
