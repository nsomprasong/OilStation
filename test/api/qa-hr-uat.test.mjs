import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaHrUatApi} from '../../src/api/qa-hr-uat.mjs';

const station='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const other='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const id='11111111-1111-4111-8111-111111111111';
const env={
 OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_HR_UAT_ENABLED:'true',
 OILSTATION_QA_STATION_IDS:[
  station,other,'24dc4981-0e6f-4b86-bfd7-03717002d0be',
  '02183a4e-47b0-4575-9f4f-74cec6553205',
 ].join(','),
};
let writes=0;
const deps=({qa=true,stationId=station}={})=>({
 env:{...env},
 authenticate:async()=>({id,isQa:qa}),
 db:{
  memberships:async()=>[{active:true,scope_type:'station',
   station_id:stationId,role_code:'hr_manager'}],
  hrRoster:async()=>({employees:[],templates:[],assignments:[]}),
  hrSeedTemplates:async()=>{writes++;return {templates:3};},
  hrAddEmployee:async()=>{writes++;return {id:'22222222-2222-4222-8222-222222222222'};},
 },
});
const req=(path,body=null,origin='https://oilstation.goldensoft.cloud')=>
 new Request('https://oilstation.goldensoft.cloud'+path,{
  method:body?'POST':'GET',
  headers:{authorization:'Bearer qa_token',...(body?{'content-type':'application/json',origin}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
 });
test('QA HR disabled unless dedicated opt-in flag is true',async()=>{
 const d=deps();d.env.OILSTATION_QA_HR_UAT_ENABLED='false';
 assert.equal((await createQaHrUatApi(d)(req('/api/hr/roster?stationId='+station))).status,404);
});
test('QA HR denies real users, foreign fixed stations and arbitrary stations',async()=>{
 const q=req('/api/hr/roster?stationId='+station);
 assert.equal((await createQaHrUatApi(deps({qa:false}))(q)).status,403);
 assert.equal((await createQaHrUatApi(deps())(req('/api/hr/roster?stationId='+other))).status,403);
 assert.equal((await createQaHrUatApi(deps({stationId:'3b24ee21-713b-4d0f-a352-7dc71a82e471'}))(q)).status,403);
});
test('QA HR only delegates requested permitted role GET to existing API',async()=>{
 const res=await createQaHrUatApi(deps())(req('/api/hr/roster?stationId='+station));
 assert.equal(res.status,200);
 const body=await res.json();
 assert.deepEqual(body.roster.employees,[]);
 assert.equal((await createQaHrUatApi(deps())(req('/api/payroll/approve'))).status,404);
});
test('QA HR enforces origin and station before any changes',async()=>{
 writes=0;
 const d=deps();
 const body={stationId:station};
 assert.equal((await createQaHrUatApi(d)(req('/api/hr/seed-shifts',body,'https://attacker.example'))).status,403);
 assert.equal((await createQaHrUatApi(d)(req('/api/hr/seed-shifts',{stationId:other}))).status,403);
 assert.equal(writes,0);
 assert.equal((await createQaHrUatApi(d)(req('/api/hr/seed-shifts',body))).status,200);
 assert.equal(writes,1);
});
test('QA HR writes use real validated HR RPC interface only in scoped station',async()=>{
 writes=0;
 const d=deps();
 const employee={stationId:station,employeeCode:'QA20261101A',
   name:'พนักงานทดสอบ QA',wageType:'daily',wageSatang:'35000',payrollFrequency:'monthly'};
 const r=await createQaHrUatApi(d)(req('/api/hr/employees',employee));
 assert.equal(r.status,201);
 assert.equal(writes,1);
 const wrong=await createQaHrUatApi(d)(req('/api/hr/employees',{...employee,stationId:other}));
 assert.equal(wrong.status,403);
 assert.equal(writes,1);
});
