import test from 'node:test';
import assert from 'node:assert/strict';
import {createFuelPhotoApi} from '../../src/api/fuel-photo.mjs';
const U='11111111-1111-4111-8111-111111111111';
const S='22222222-2222-4222-8222-222222222222';
const F='33333333-3333-4333-8333-333333333333';
const E='44444444-4444-4444-8444-444444444444';
const path='https://oilstation.goldensoft.cloud/api/evidence/fuel?sessionId='+F+'&kind=pump_display';
const bytes=new Uint8Array(120);bytes.set([255,216,255,224]);
function app(allowed=true){
 const calls=[];
 const handle=createFuelPhotoApi({authenticate:async t=>t==='good'?{id:U}:null,
 db:{
  authorizeFuelPhoto:async d=>{calls.push(['auth',d]);if(!allowed)throw {code:'FORBIDDEN'};return {stationId:S};},
  uploadFuelPhoto:async d=>{calls.push(['upload',d]);return 'stations/'+S+'/sessions/'+F+'/pump_display/'+E+'.jpg';},
  recordFuelPhoto:async d=>{calls.push(['record',d]);return {evidenceId:E};},
 }});
 return {calls,handle};
}
const request=(url=path,body=bytes,headers={})=>new Request(url,{method:'POST',
 headers:{authorization:'Bearer good','content-type':'image/jpeg',...headers},body});
test('private pump photo upload is authorized before storing, never auto approved',async()=>{
 const a=app();const r=await a.handle(request());
 assert.equal(r.status,201);
 const response=await r.json();
 assert.deepEqual(response.evidence,{evidenceId:E,status:'pending_ocr',verified:false});
 assert.equal(JSON.stringify(response).includes('stations/'),false);
 assert.deepEqual(a.calls.map(x=>x[0]),['auth','upload','record']);
 assert.equal(a.calls[0][1].actorId,U);
});
test('station role mismatch stops photo before bytes or storage',async()=>{
 const a=app(false);
 assert.equal((await a.handle(request())).status,403);
 assert.deepEqual(a.calls.map(x=>x[0]),['auth']);
});
test('malformed session, kind, mime, origin and token never write',async()=>{
 const a=app();
 assert.equal((await a.handle(request(path.replace('pump_display','other')))).status,400);
 assert.equal((await a.handle(request(path.replace(F,'bad')))).status,400);
 assert.equal((await a.handle(request(path,bytes,{'content-type':'text/plain'}))).status,415);
 assert.equal((await a.handle(request(path,bytes,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await a.handle(request(path,bytes,{authorization:'Bearer wrong'}))).status,401);
 assert.equal(a.calls.length,0);
});
test('oversized and forged MIME reject before writing any private image',async()=>{
 const a=app();const huge=new Uint8Array(5*1024*1024+1);huge.set([255,216,255]);
 assert.equal((await a.handle(request(path,huge))).status,400);
 const png=new Uint8Array(100);png.set([137,80,78,71,13,10,26,10]);
 assert.equal((await a.handle(request(path,png))).status,400);
 assert.deepEqual(a.calls.map(x=>x[0]),['auth','auth']);
});
