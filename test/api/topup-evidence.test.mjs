import test from 'node:test';
import assert from 'node:assert/strict';
import {createTopupEvidenceApi} from '../../src/api/topup-evidence.mjs';

const USER='11111111-1111-4111-8111-111111111111';
const ACCOUNT='22222222-2222-4222-8222-222222222222';
const BANK='33333333-3333-4333-8333-333333333333';
const RID='44444444-4444-4444-8444-444444444444';
const URL='https://oilstation.goldensoft.cloud/api/evidence/topup'
 +'?accountId='+ACCOUNT+'&bankId='+BANK+'&amountSatang=25000';
const SLIP='https://oilstation.goldensoft.cloud/api/evidence/topup-slip?requestId='+RID;
const image=new Uint8Array(120);image.set([255,216,255,224]);
function make({allowed=true,authed=true}={}){
 const calls=[];
 const api=createTopupEvidenceApi({
  authenticate:async token=>authed&&token==='valid'?{id:USER}:null,
  db:{
   canUploadTopup:async d=>{calls.push(['authorize',d]);if(!allowed)throw {code:'FORBIDDEN'};},
   uploadTopupSlip:async d=>{calls.push(['upload',d]);return 'accounts/'+ACCOUNT+'/slips/'+RID+'.jpg';},
   submitTopup:async d=>{calls.push(['submit',d]);return {requestId:RID,status:'pending'};},
   getTopupSlip:async d=>{calls.push(['read',d]);if(!allowed)throw {code:'FORBIDDEN'};
    return {bytes:image,contentType:'image/jpeg'};},
  },
 });return {api,calls};
}
const req=(uri=URL,body=image,auth='Bearer valid',origin=null,mime='image/jpeg')=>{
 const headers={authorization:auth,'content-type':mime};
 if(origin)headers.origin=origin;
 return new Request(uri,{method:'POST',headers,body});
};
test('authenticated customer uploads slip, creates pending request without touching balance',async()=>{
 const {api,calls}=make();
 const res=await api(req());
 assert.equal(res.status,201);
 const json=await res.json();
 assert.deepEqual(json.request,{requestId:RID,status:'pending',verified:false});
 assert.deepEqual(calls.map(x=>x[0]),['authorize','upload','submit']);
 assert.equal(calls[0][1].actorId,USER);
 assert.equal(calls[2][1].amountSatang,'25000');
});
test('unauthorized accounts and mismatched session stop before reading image',async()=>{
 const a=make({allowed:false});
 assert.equal((await a.api(req())).status,403);
 assert.deepEqual(a.calls.map(x=>x[0]),['authorize']);
 const b=make();
 assert.equal((await b.api(req(URL,image,'Bearer bogus'))).status,401);
 assert.equal(b.calls.length,0);
});
test('malformed account, invalid amounts, wrong origin, HTML are rejected',async()=>{
 const {api,calls}=make();
 assert.equal((await api(req(URL.replace(ACCOUNT,'bad')))).status,400);
 assert.equal((await api(req(URL.replace('25000','0')))).status,400);
 assert.equal((await api(req(URL,image,'Bearer valid','https://wrong.invalid'))).status,403);
 assert.equal((await api(req(URL,image,'Bearer valid',null,'text/html'))).status,415);
 assert.equal(calls.length,0);
});
test('fake JPEG signature and oversized images never reach storage',async()=>{
 const a=make();
 const fake=new Uint8Array(150);fake.set([137,80,78,71,13,10,26,10]);
 assert.equal((await a.api(req(URL,fake))).status,400);
 const huge=new Uint8Array(5*1024*1024+1);huge.set([255,216,255]);
 assert.equal((await a.api(req(URL,huge))).status,400);
 assert.deepEqual(a.calls.map(x=>x[0]),['authorize','authorize']);
});
test('staff with valid access may read exact private slip; response is no-store attachment',async()=>{
 const a=make();
 const res=await a.api(new Request(SLIP,{headers:{authorization:'Bearer valid'}}));
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'no-store, private');
 assert.match(res.headers.get('content-disposition'),/^attachment/);
 assert.equal((await res.arrayBuffer()).byteLength,image.byteLength);
 assert.deepEqual(a.calls.map(x=>x[0]),['read']);
});
test('cross-station reader cannot get slip, unauthenticated cannot get bytes',async()=>{
 const a=make({allowed:false});
 const denied=await a.api(new Request(SLIP,{headers:{authorization:'Bearer valid'}}));
 assert.equal(denied.status,403);
 const b=make();
 assert.equal((await b.api(new Request(SLIP))).status,401);
 assert.equal(b.calls.length,0);
});
