import test from 'node:test';
import assert from 'node:assert/strict';
import {createFuelReviewApi} from '../../src/api/fuel-review.mjs';
const U='11111111-1111-4111-8111-111111111111';
const S='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333';
const R='44444444-4444-4444-8444-444444444444';
const base='https://oilstation.goldensoft.cloud';
function app(denied=false){
 const calls=[];const handler=createFuelReviewApi({authenticate:async t=>t==='ok'?{id:U}:null,
 db:{
  fuelReviewInbox:async d=>{calls.push(['list',d]);if(denied)throw {code:'FORBIDDEN'};return []},
  fuelReviewPhotoAccess:async d=>{calls.push(['access',d]);if(denied)throw {code:'FORBIDDEN'};return {path:'private.jpg'}},
  readFuelPhoto:async p=>{calls.push(['image',p]);return {bytes:new Uint8Array(70),contentType:'image/jpeg'}},
  reviewFuelPhoto:async d=>{calls.push(['review',d]);if(denied)throw {code:'FORBIDDEN'};return {status:'approved'}},
  finishReviewedFueling:async d=>{calls.push(['finish',d]);if(denied)throw {code:'INVALID_REQUEST'};return {status:'completed',replayed:false}},
 }});
 return {handler,calls};
}
const post=(path,body,extra={})=>new Request(base+path,{method:'POST',headers:{
 authorization:'Bearer ok','content-type':'application/json',...extra},body:JSON.stringify(body)});
const get=(path,auth='ok')=>new Request(base+path,{headers:{authorization:'Bearer '+auth}});
test('supervisor list is scoped and private image is not fetched before DB authorization',async()=>{
 const a=app();
 assert.equal((await a.handler(get('/api/evidence/fuel/reviews?stationId='+S))).status,200);
 const image=await a.handler(get('/api/evidence/fuel/photo?evidenceId='+P));
 assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/no-store/);
 assert.deepEqual(a.calls.map(c=>c[0]),['list','access','image']);
 const b=app(true);
 assert.equal((await b.handler(get('/api/evidence/fuel/photo?evidenceId='+P))).status,403);
 assert.deepEqual(b.calls.map(c=>c[0]),['access']);
});
test('explicit supervisor meter/receipt values are validated, not silently trusted for settlement',async()=>{
 const a=app();
 assert.equal((await a.handler(post('/api/evidence/fuel/review',{
 evidenceId:P,approved:true,liters:'30.500',grossSatang:'110000'}))).status,200);
 assert.equal(a.calls[0][1].actorId,U);
 for(const body of [
 {evidenceId:P,approved:true,liters:'NaN',grossSatang:'100'},
 {evidenceId:P,approved:true,grossSatang:'1.0'},
 {evidenceId:P,approved:true,grossSatang:'100',verified:true},
 ]){
  assert.equal((await a.handler(post('/api/evidence/fuel/review',body))).status,400);
 }
 assert.deepEqual(a.calls.map(c=>c[0]),['review']);
});
test('finish accepts proof IDs ONLY, never client supplied price, liters or paths',async()=>{
 const a=app();
 const valid={sessionId:S,pumpEvidenceId:P,receiptEvidenceId:R};
 assert.equal((await a.handler(post('/api/fuel/finish',valid))).status,200);
 assert.deepEqual(a.calls[0][1],{actorId:U,...valid});
 assert.equal((await a.handler(post('/api/fuel/finish',{...valid,grossSatang:'1'}))).status,400);
 assert.equal((await a.handler(post('/api/fuel/finish',{...valid,receiptEvidenceId:P}))).status,400);
 assert.equal(a.calls.length,1);
 const b=app(true);
 assert.equal((await b.handler(post('/api/fuel/finish',valid))).status,409);
});
test('cross-origin, unverified identity and bad IDs cannot review evidence',async()=>{
 const a=app();
 assert.equal((await a.handler(post('/api/evidence/fuel/review',{
  evidenceId:P,approved:false},{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await a.handler(get('/api/evidence/fuel/reviews?stationId=bad'))).status,400);
 assert.equal((await a.handler(get('/api/evidence/fuel/photo?evidenceId='+P,'bad'))).status,401);
 assert.equal(a.calls.length,0);
});
