import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlatformSupportApi} from '../../src/api/platform-support.mjs';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const uid='11111111-1111-4111-8111-111111111111';
const base='https://oilstation.goldensoft.cloud/api/platform/support/overview';
const req=(path=base,auth=true,method='GET')=>new Request(path,{method,
 headers:auth?{authorization:'Bearer qa'}:{}});
const role=x=>({scope_type:'platform',role_code:x,active:true});
const handler=(members,calls)=>createPlatformSupportApi({authenticate:async()=>({id:uid}),
 db:{memberships:async()=>members,platformSupportOverview:async d=>{
  calls.push(d);return {readOnly:true,stations:[],activity:[]};}}});
test('Support receives only a scoped read-only workspace, no finance or Sales',()=>{
 assert.deepEqual(selectWorkspaceScreens([{scopeType:'platform',role:'platform_support'}])
  .map(x=>x.key),['overview','support']);
 for(const roleCode of ['platform_sales','platform_superadmin']){
  assert.ok(!selectWorkspaceScreens([{scopeType:'platform',role:roleCode}])
   .map(x=>x.key).includes('support'));
 }
});
test('Support API double-checks authenticated platform roles and refuses mutation',async()=>{
 const calls=[],support=handler([role('platform_support')],calls);
 assert.equal((await support(req(base,false))).status,401);
 assert.equal((await support(req(base,true,'POST'))).status,405);
 assert.equal((await support(req(base+'?stationId=all'))).status,400);
 assert.equal((await support(req())).status,200);
 assert.deepEqual(calls,[{actorId:uid}]);
 assert.equal((await handler([role('platform_sales')],calls)(req())).status,403);
 assert.equal((await handler([{...role('platform_support'),active:false}],calls)(req())).status,403);
 assert.equal((await handler([role('platform_superadmin')],calls)(req())).status,200);
});
test('Support SQL restricts QA stations and never expands table read privileges',()=>{
 const sql=readFileSync('supabase/migrations/20261031180000_platform_support_readonly.sql','utf8');
 for(const val of ["SECURITY DEFINER SET search_path=''","'QA-20261031-PLATFORM-001'",
  "'QA-S02-B'","'platform_support'","FROM PUBLIC, anon, authenticated","TO service_role"])
  assert.ok(sql.includes(val),val);
 assert.doesNotMatch(sql,/\bINSERT INTO\b|\bDELETE FROM\b|\bUPDATE public\.|\bTRUNCATE\b/i);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|ALL) ON TABLE/i);
 const ui=readFileSync('src/client/platform-support.js','utf8');
 assert.doesNotMatch(ui,/\bPOST\b|\/api\/billing|\/api\/qa\/accounts/);
});
