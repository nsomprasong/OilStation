import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlateReviewInboxApi} from '../../src/api/plate-review-inbox.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const PHOTO='33333333-3333-4333-8333-333333333333';
const host='https://oilstation.goldensoft.cloud';
function app(denied=false){
 const seen=[];
 const handler=createPlateReviewInboxApi({authenticate:async t=>t==='good'?{id:USER}:null,db:{
  stationPlateReviewInbox:async v=>{seen.push(['list',v]);if(denied)throw {code:'FORBIDDEN'};return [{photoId:PHOTO}];},
  platePhotoAccess:async v=>{seen.push(['access',v]);if(denied)throw {code:'FORBIDDEN'};return {path:'private/test.jpg'};},
  readPlate:async p=>{seen.push(['read',p]);return {bytes:new Uint8Array(96),contentType:'image/jpeg'};},
 }});
 return {handler,seen};
}
const req=(path,token='good')=>new Request(host+path,{headers:{authorization:'Bearer '+token}});
test('supervisor queue is scoped by actor and station',async()=>{
 const a=app();const response=await a.handler(req('/api/evidence/plate/reviews?stationId='+STATION));
 assert.equal(response.status,200);
 assert.equal((await response.json()).reviews[0].photoId,PHOTO);
 assert.deepEqual(a.seen[0][1],{actorId:USER,stationId:STATION});
});
test('private photo access is authorized before bytes and returns no-store',async()=>{
 const a=app();const response=await a.handler(req('/api/evidence/plate/photo?photoId='+PHOTO));
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(response.headers.get('content-type'),'image/jpeg');
 assert.deepEqual(a.seen.map(x=>x[0]),['access','read']);
});
test('unauthorized user and station never read photo bytes',async()=>{
 const a=app(true);
 assert.equal((await a.handler(req('/api/evidence/plate/photo?photoId='+PHOTO))).status,403);
 assert.deepEqual(a.seen.map(x=>x[0]),['access']);
 const b=app();
 assert.equal((await b.handler(req('/api/evidence/plate/photo?photoId='+PHOTO,'bad'))).status,401);
 assert.equal((await b.handler(req('/api/evidence/plate/photo?photoId=bad'))).status,400);
 assert.deepEqual(b.seen,[]);
});
