import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceApi } from '../../src/api/evidence.mjs';

const STATION='22222222-2222-4222-8222-222222222222';
const COUPON='33333333-3333-4333-8333-333333333333';
const USER='11111111-1111-4111-8111-111111111111';
const endpoint='https://oilstation.goldensoft.cloud/api/evidence/plate?stationId='+STATION+'&couponId='+COUPON;
const jpg=new Uint8Array(120);jpg.set([0xff,0xd8,0xff,0xe0]);
function app({loggedIn=true,allowed=true}={}){
 const calls=[];
 const handler=createEvidenceApi({
  authenticate:async token=>loggedIn&&token==='good'?{id:USER}:null,
  db:{
   canUploadPlate:async d=>{calls.push(['allow',d]);if(!allowed)throw {code:'FORBIDDEN'};},
   uploadPlate:async d=>{calls.push(['upload',d]);return 'stations/'+STATION+'/plate/'+COUPON+'/image.jpg';},
   recordPlate:async d=>{calls.push(['record',d]);return {status:'pending_review'};},
  },
 });
 return {handler,calls};
}
function req(bytes=jpg,{authorization='Bearer good',mime='image/jpeg',origin=null,uri=endpoint}={}){
 const headers={'content-type':mime,authorization};
 if(origin)headers.origin=origin;
 return new Request(uri,{method:'POST',headers,body:bytes});
}
test('verified same-station staff can upload private plate proof, requires independent manual review',async()=>{
 const a=app();
 const r=await a.handler(req());
 assert.equal(r.status,201);
 const body=await r.json();
 assert.equal(body.evidence.verified,false);
 assert.equal(body.evidence.status,'pending_review');
 assert.deepEqual(a.calls.map(c=>c[0]),['allow','upload','record']);
 assert.equal(a.calls[0][1].actorId,USER);
});
test('missing auth and unassigned station never read or store evidence',async()=>{
 const a=app();
 assert.equal((await a.handler(req(jpg,{authorization:'Bearer bad'}))).status,401);
 assert.equal(a.calls.length,0);
 const b=app({allowed:false});
 assert.equal((await b.handler(req())).status,403);
 assert.deepEqual(b.calls.map(c=>c[0]),['allow']);
});
test('wrong origin, malformed identifiers and unsupported media are rejected',async()=>{
 const a=app();
 assert.equal((await a.handler(req(jpg,{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await a.handler(req(jpg,{mime:'text/html'}))).status,415);
 assert.equal((await a.handler(req(jpg,{uri:'https://oilstation.goldensoft.cloud/api/evidence/plate?stationId=wrong&couponId='+COUPON}))).status,400);
 assert.equal(a.calls.length,0);
});
test('jpeg claim with PNG bytes and unusually small files are rejected',async()=>{
 const a=app();
 const png=new Uint8Array(120);png.set([137,80,78,71,13,10,26,10]);
 assert.equal((await a.handler(req(png))).status,400);
 assert.equal((await a.handler(req(new Uint8Array([255,216,255])))).status,400);
 assert.deepEqual(a.calls.map(c=>c[0]),['allow','allow']);
});
test('oversized image upload fails before storage call',async()=>{
 const a=app();const huge=new Uint8Array(5*1024*1024+1);huge.set([255,216,255]);
 const r=await a.handler(req(huge));
 assert.equal(r.status,400);
 assert.deepEqual(a.calls.map(c=>c[0]),['allow']);
});
