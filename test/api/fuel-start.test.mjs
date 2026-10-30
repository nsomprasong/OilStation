import test from 'node:test';
import assert from 'node:assert/strict';
import {createFuelStartApi} from '../../src/api/fuel-start.mjs';
const U='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const URL='https://oilstation.goldensoft.cloud/api/fuel/start';
const calls=[];
const app=createFuelStartApi({authenticate:async t=>t==='good'?{id:U}:null,
 db:{beginVerifiedFueling:async v=>{calls.push(v);return {id:P,status:'fueling'};}}});
const req=(data={photoId:P},headers={})=>new Request(URL,{method:'POST',headers:{
 authorization:'Bearer good','content-type':'application/json',...headers},body:JSON.stringify(data)});
test('station start uses only authenticated actor and trusted photo id',async()=>{
 calls.length=0;const r=await app(req());assert.equal(r.status,200);
 assert.equal((await r.json()).session.status,'fueling');
 assert.deepEqual(calls,[{actorId:U,photoId:P}]);
});
test('cannot spoof plate, storage path, station or locked public price',async()=>{
 calls.length=0;
 for(const extra of [{plate:'กข1234'},{storagePath:'anything.jpg'},{stationId:P},{publicPrice:0}]){
   assert.equal((await app(req({photoId:P,...extra}))).status,400);
 }
 assert.equal(calls.length,0);
});
test('invalid, unauthenticated and cross-origin requests fail before RPC',async()=>{
 calls.length=0;
 assert.equal((await app(req({photoId:'bad'}))).status,400);
 assert.equal((await app(req(undefined,{authorization:'Bearer bad'}))).status,401);
 assert.equal((await app(req(undefined,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await app(new Request(URL,{method:'GET'}))).status,405);
 assert.equal(calls.length,0);
});
