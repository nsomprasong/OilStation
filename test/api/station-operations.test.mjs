import test from 'node:test';
import assert from 'node:assert/strict';
import {createStationOperationsApi,STATION_OPERATIONS_ROUTES} from '../../src/api/station-operations.mjs';
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const S='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const M='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const root='https://oilstation.goldensoft.cloud';
function factory(){
 const calls=[];
 const db={
  stationCustomerOverview:(...v)=>{calls.push(['credits',...v]);return [{accountId:C,availableSatang:'0'}];},
  stationFuelPlateReport:v=>{calls.push(['report',v]);return [{plate:'QA 1001',amountSatang:'2820'}];},
  memberDirectory:v=>{calls.push(['members',v]);return [{membershipId:M,role:'driver',active:true}];},
  memberChange:v=>{calls.push(['change',v]);return {success:true};},
 };
 return {handler:createStationOperationsApi({authenticate:async token=>
    token==='valid'?{id:U}:null,db}),calls};
}
const get=(path,token='valid')=>new Request(root+path,{headers:{authorization:'Bearer '+token}});
const post=(path,body,origin=root)=>new Request(root+path,{method:'POST',
 headers:{authorization:'Bearer valid','content-type':'application/json',origin},
 body:JSON.stringify(body)});
test('scoped routes reject anonymous station financial and HR access',async()=>{
 assert.deepEqual(STATION_OPERATIONS_ROUTES,['/api/station/customer-overview','/api/fuel/report',
  '/api/members/directory','/api/members/change','/api/hr/employee-change']);
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/station/customer-overview?stationId='+S,''))).status,401);
 assert.equal((await handler(get('/api/station/customer-overview?stationId='+S,'bogus'))).status,401);
 assert.equal((await handler(get('/api/unknown'))).status,404);
 assert.deepEqual(calls,[]);
});
test('credit overview and plate report require validated IDs and return only server data',async()=>{
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/station/customer-overview?stationId=x'))).status,400);
 assert.equal((await handler(get('/api/fuel/report?stationId='+S+'&companyId=x'))).status,400);
 assert.equal((await handler(get('/api/fuel/report?stationId='+S+'&plate='+('A'.repeat(41))))).status,400);
 const credits=await handler(get('/api/station/customer-overview?stationId='+S));
 assert.equal(credits.status,200);
 assert.equal((await credits.json()).accounts[0].availableSatang,'0');
 const report=await handler(get('/api/fuel/report?stationId='+S+'&companyId='+C+'&plate=QA%201001'));
 assert.equal(report.status,200);
 assert.equal((await report.json()).rows[0].plate,'QA 1001');
 assert.equal(calls[1][1].companyId,C);
 assert.equal(calls[1][1].plate,'QA 1001');
});
test('directory and soft-deactivation require scope, POST origin and explicit confirmation',async()=>{
 const {handler,calls}=factory();
 assert.equal((await handler(get('/api/members/directory?scopeId='+S+'&scopeType=platform'))).status,400);
 assert.equal((await handler(get('/api/members/directory?scopeId='+S+'&scopeType=station'))).status,200);
 assert.equal((await handler(post('/api/members/change',{membershipId:M,action:'deactivate'}))).status,400);
 assert.equal((await handler(post('/api/members/change',{membershipId:M,action:'deactivate',confirm:true},'https://other.example'))).status,403);
 const changed=await handler(post('/api/members/change',{membershipId:M,action:'edit',roleCode:'accountant'}));
 assert.equal(changed.status,200);
 assert.deepEqual(calls.at(-1)[1],{actorId:U,membershipId:M,action:'edit',roleCode:'accountant'});
 const off=await handler(post('/api/members/change',{membershipId:M,action:'deactivate',confirm:true}));
 assert.equal(off.status,200);
 assert.equal(calls.at(-1)[1].roleCode,null);
});
