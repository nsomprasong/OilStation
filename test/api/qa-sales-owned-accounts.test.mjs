import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQaAccountsApi,qaVisibleScopes} from '../../src/api/qa-accounts.mjs';
const station='22222222-2222-4222-8222-222222222222';
const org='33333333-3333-4333-8333-333333333333';
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:[station,'11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'].join(','),
 OILSTATION_QA_ORGANIZATION_IDS:org};
const base='https://oilstation.goldensoft.cloud/api/qa/';
const token='Bearer test';
const post=(alias,scopeType,scopeId,roleCode)=>new Request(base+'accounts',{
 method:'POST',headers:{authorization:token,origin:'https://oilstation.goldensoft.cloud',
  'content-type':'application/json'},
 body:JSON.stringify({alias,scopeType,scopeId,roleCode,password:'DelegatedPassword2026!Strong'})});
test('Sales cannot create ANY QA employee or bootstrap Admin, even on own assigned station',async()=>{
 let called=0;
 const api=createQaAccountsApi({env,authenticate:async()=>({id:station,isQa:true}),
 db:{memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}],
  qaScopedOptions:async()=>({station:[],organization:[],corporate_company:[],platform:[]})},
 provisionAccount:async()=>{called++;return {}}});
 assert.equal((await api(post('s01a-manager','station',station,'manager'))).status,403);
 assert.equal((await api(post('s01a-owner','station',station,'station_owner'))).status,403);
 assert.equal((await api(new Request(base+'scopes',{headers:{authorization:token}}))).status,403);
 assert.equal(called,0);
});
test('only role-filtered Admin scope IDs remain visible; global aliases do not shift',()=>{
 const station2='66666666-6666-4666-8666-666666666666';
 const org2='77777777-7777-4777-8777-777777777777';
 const visible=qaVisibleScopes({platform:[{id:null}],station:[{id:station},{id:station2}],
 organization:[{id:org},{id:org2}],corporate_company:[]},
 {platform:[],station:[station2],organization:[org2],corporate_company:[]});
 assert.deepEqual(visible.station.map(x=>x.aliasPrefix),['s01b']);
 assert.deepEqual(visible.organization.map(x=>x.aliasPrefix),['o02']);
 assert.deepEqual(visible.platform,[]);
});
test('SQL override removes Sales staff invites but preserves strictly limited first-owner handoff',()=>{
 const sql=readFileSync('supabase/migrations/20261031223000_qa_admin_owned_staff_and_company_bootstrap.sql','utf8').replace(/\r\n/g,'\n');
 assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.create_scoped_invitation'));
 assert.ok(sql.includes("v_sales_owns_station\n    AND p_role_code='station_owner'"));
 assert.ok(sql.includes("v_sales_owns_org\n   AND p_role_code='organization_owner'"));
 assert.ok(sql.includes('AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active'));
 assert.ok(sql.includes('v_platform_admin OR EXISTS('));
 assert.doesNotMatch(sql,/v_allowed:=v_platform_admin OR v_sales_owns_station OR EXISTS/);
 assert.doesNotMatch(sql,/v_allowed:=v_platform_admin OR v_sales_owns_org OR EXISTS/);
 assert.match(sql,/TO service_role/);
});
test('Sales web station directory offers only initial administrator invitations, no staff roles',()=>{
 const s=readFileSync('src/client/main.js','utf8').replace(/\r\n/g,'\n');
 const begin=s.indexOf('if(salesMode){\n        const hint=');
 const end=s.indexOf('node.append(name,detail,hint,actions);',begin);
 assert.ok(begin>=0&&end>begin);
 const segment=s.slice(begin,end);
 assert.match(segment,/\['station_owner','เจ้าของปั๊ม'\]/);
 assert.match(segment,/\['organization_owner','เจ้าขององค์กร'\]/);
 for(const role of ["['cashier'","['manager'","['attendant'","['hr_manager'","['finance_manager'"])
  assert.ok(!segment.includes(role),'Sales should not invite '+role);
 assert.match(s,/mode:'station_owner'/);
 assert.match(s,/mode:'corporate_admin'/);
});
