import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQaAccountsApi,qaVisibleScopes} from '../../src/api/qa-accounts.mjs';
import {createApi} from '../../src/api/router.mjs';

const actor='11111111-1111-4111-8111-111111111111';
const stations=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',
 '66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777'];
const orgs=['11111111-2222-4222-8222-222222222222','11111111-3333-4333-8333-333333333333',
 '11111111-6666-4666-8666-666666666666','11111111-7777-4777-8777-777777777777'];
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:stations.join(','),OILSTATION_QA_ORGANIZATION_IDS:orgs.join(','),
 OILSTATION_QA_COMPANY_IDS:''};
const host='https://oilstation.goldensoft.cloud/api/qa/';
const pw='DelegatedPassword2026!Strong';
const role=(roleCode='platform_sales')=>[{scope_type:'platform',role_code:roleCode,active:true}];
const request=(endpoint,body)=>new Request(host+endpoint,{
 method:'POST',headers:{authorization:'Bearer sales02',origin:'https://oilstation.goldensoft.cloud',
 'content-type':'application/json'},body:JSON.stringify(body)});
const account=(alias,roleCode,scopeType,scopeId)=>({alias,password:pw,roleCode,scopeType,scopeId});
const handler=(config={})=>{
 const called=[];
 const mock={
  memberships:async()=>role(),
  qaScopedOptions:async allowed=>({
   platform:[{id:null,name:'Platform'}],
   organization:allowed.organization.map(id=>({id,name:'QA Org'})),
   station:allowed.station.map(id=>({id,name:'QA Station'})),
   corporate_company:[],
  }),
  qaSalesScopes:async()=>({organization:orgs.slice(2),station:stations.slice(2)}),
  ...config.db,
 };
 const handler=createQaAccountsApi({
  env,authenticate:config.authenticate|| (async()=>({id:actor,isQa:true})),
  db:mock,provisionAccount:async args=>{called.push(args);return {alias:args.alias,id:'qa-created'}},
  resetQaPassword:async()=>true,
 });
 return {handler,called};
};
test('Sales02 sees ONLY s02a/s02b and o03/o04, preserving global QA aliases',async()=>{
 const a=handler();
 const response=await a.handler(new Request(host+'scopes',{headers:{authorization:'Bearer sales02'}}));
 assert.equal(response.status,200);
 const scopes=(await response.json()).scopes;
 assert.deepEqual(scopes.station.map(x=>x.id),stations.slice(2));
 assert.deepEqual(scopes.station.map(x=>x.aliasPrefix),['s02a','s02b']);
 assert.deepEqual(scopes.organization.map(x=>x.id),orgs.slice(2));
 assert.deepEqual(scopes.organization.map(x=>x.aliasPrefix),['o03','o04']);
 assert.deepEqual(scopes.platform,[]);
 assert.deepEqual(scopes.corporate_company,[]);
});
test('Sales02 can create own Station and Org QA roles but NO accounts of Sales01',async()=>{
 const a=handler();
 for(const [alias,roleCode,scopeType,scopeId] of [
  ['s02a-manager','manager','station',stations[2]],
  ['s02b-owner','station_owner','station',stations[3]],
  ['o03-owner','organization_owner','organization',orgs[2]],
  ['o04-billing','billing_manager','organization',orgs[3]],
 ]){
  const res=await a.handler(request('accounts',account(alias,roleCode,scopeType,scopeId)));
  assert.equal(res.status,201,alias);
 }
 assert.equal(a.called.length,4);
 for(const [alias,roleCode,scopeType,scopeId,expected] of [
  ['s01a-manager','manager','station',stations[0],403],
  ['s01b-owner','station_owner','station',stations[1],403],
  ['o01-owner','organization_owner','organization',orgs[0],403],
  ['sales01','platform_sales','platform',null,403],
  ['support01','platform_support','platform',null,403],
  ['s01a-manager','manager','station',stations[2],400]
 ]){
  const res=await a.handler(request('accounts',account(alias,roleCode,scopeType,scopeId)));
  assert.equal(res.status,expected,alias);
 }
 assert.equal(a.called.length,4,'no cross-Sales Auth creation attempted');
});
test('Sales cannot reset any QA password or open QA if not itself a synthetic Sales',async()=>{
 const a=handler();
 const reset=await a.handler(request('reset-password',{alias:'sales01',password:pw}));
 assert.equal(reset.status,403);
 const nonQa=handler({authenticate:async()=>({id:actor})});
 assert.equal((await nonQa.handler(request('accounts',account('s02a-manager','manager','station',stations[2])))).status,403);
 const noMembership=handler({db:{memberships:async()=>role('station_owner')}});
 assert.equal((await noMembership.handler(request('accounts',account('s02a-manager','manager','station',stations[2])))).status,403);
});
test('global numbering survives Sales filtered list and avoids s01 impersonation',()=>{
 const visible=qaVisibleScopes({platform:[{id:null}],station:stations.map(id=>({id})),
  organization:orgs.map(id=>({id})),corporate_company:[]},
  {station:stations.slice(2),organization:orgs.slice(2)});
 assert.deepEqual(visible.station.map(x=>x.aliasPrefix),['s02a','s02b']);
 assert.deepEqual(visible.organization.map(x=>x.aliasPrefix),['o03','o04']);
});
test('Invitation route forwards authorized Sales actor and role; SQL independently validates ownership',async()=>{
 const calls=[];
 const app=createApi({authenticate:async()=>({id:actor}),
  db:{memberships:async()=>role(),createInvitation:async d=>{
   calls.push(d);if(d.scopeId!==stations[2]){const error=new Error('forbidden');error.code='FORBIDDEN';throw error;}
   return {id:'safe',email:d.email,role:d.roleCode,scopeType:d.scopeType};
  }},now:()=>new Date('2026-10-31T11:00:00.000Z')});
 const url='https://oilstation.goldensoft.cloud/api/invitations/create';
 const send=roleCode=>new Request(url,{method:'POST',headers:{
  authorization:'Bearer s02','content-type':'application/json',origin:'https://oilstation.goldensoft.cloud'},
 body:JSON.stringify({email:'qa-invite@qa.oilstation.invalid',roleCode,scopeType:'station',scopeId:stations[2]})});
 assert.equal((await app(send('station_owner'))).status,201);
 assert.equal((await app(send('hr_manager'))).status,201);
 assert.equal((await app(send('finance_manager'))).status,201);
 assert.equal(calls.length,3);
 const cross=new Request(url,{method:'POST',headers:{
  authorization:'Bearer s02','content-type':'application/json',
  origin:'https://oilstation.goldensoft.cloud'},
 body:JSON.stringify({email:'qa-invite@qa.oilstation.invalid',
 roleCode:'station_owner',scopeType:'station',scopeId:stations[0]})});
 assert.equal((await app(cross)).status,403);
});
test('SQL guards both real invitations AND QA membership creation at DB boundary',()=>{
 const sql=readFileSync('supabase/migrations/20261031190000_sales_owned_account_delegation.sql','utf8');
 for(const snippet of [
  "public.oilstation_sales_owns_scope",
  'JOIN public.sales_station_creation_requests r ON r.station_id=sa.station_id',
  'sa.effective_from<=clock_timestamp()',
  'sa.effective_until IS NULL OR sa.effective_until>clock_timestamp()',
  'NOT public.oilstation_sales_owns_scope',
  "v_sales_owns_station:=public.oilstation_sales_owns_scope",
  "v_sales_owns_org:=public.oilstation_sales_owns_scope",
  "v_sales_owns:=public.oilstation_sales_owns_scope",
  "'organization','station'",
  "FROM PUBLIC,anon,authenticated",
  "TO service_role",
 ])assert.ok(sql.includes(snippet),snippet);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON (?:TABLE |public\.)/i);
 const ui=readFileSync('src/client/main.js','utf8');
 assert.match(ui,/createInviteControl\(accessToken,'organization',s.organizationId/);
 assert.match(ui,/createInviteControl\(accessToken,'station',s.id/);
 assert.match(ui,/mountQaAccountsAdmin\(\{target:host,token:session.access_token,salesMode:true\}\)/);
});
