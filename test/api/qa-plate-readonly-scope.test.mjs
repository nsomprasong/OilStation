import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaOperationsApi} from '../../src/api/qa-operations.mjs';
const BASE='https://oilstation.goldensoft.cloud';
const A='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const B='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const P='06533350-9254-4613-b272-7fcb00bc0656';
const ACTOR='11111111-1111-4111-8111-111111111111';
const STATIONS=[A,B,'24dc4981-0e6f-4b86-bfd7-03717002d0be','02183a4e-47b0-4575-9f4f-74cec6553205'];
const COMPANIES=['4e6a3fc9-217d-4543-885b-113f1f3ba4c3',...Array.from({length:11},(_,i)=>'00000000-0000-4000-8000-'+String(500+i).padStart(12,'0'))];
const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:STATIONS.join(','),OILSTATION_QA_COMPANY_IDS:COMPANIES.join(','),
 OILSTATION_QA_FINANCE_SIM_ENABLED:'false'};
function app({station=B,scope='station',role='station_owner',disabled=false}={}){
 const calls=[];
 const db={memberships:async()=>[{active:true,scope_type:scope,station_id:station,
  corporate_company_id:COMPANIES[0],role_code:role}],
  platePhotoAccess:async d=>{
   calls.push('authorize_photo');
   assert.equal(d.actorId,ACTOR);assert.equal(d.photoId,P);
   if(station!==A)throw {code:'FORBIDDEN'};
   return {path:'private/station-a/plate.jpg'};
  },
  readPlate:async()=>{calls.push('read_private_storage');return {bytes:new Uint8Array([255,216,255,1]),contentType:'image/jpeg'};},
  platePhotoStatus:async d=>{calls.push('status');if(station!==A)throw {code:'FORBIDDEN'};
   return {photoId:d.photoId,status:'verified_supervisor',verified:true};},
  stationPlateReviewInbox:async d=>{calls.push('inbox');if(station!==A)throw {code:'FORBIDDEN'};
   return [{photoId:P,status:'verified_supervisor'}];},
  reviewPlate:async()=>{calls.push('UNSAFE_REVIEW');throw Error('review must never execute');}
 };
 return {calls,handler:createQaOperationsApi({env:{...env,...(disabled?{OILSTATION_QA_MODE_ENABLED:'false'}:{})},
  authenticate:async()=>({id:ACTOR,isQa:true}),db})};
}
function req(path,method='GET',body){
 return new Request(BASE+path,{method,headers:{authorization:'Bearer valid',
  ...(method==='POST'?{origin:BASE,'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
}
test('unrelated QA station cannot fetch private plate photo OR photo state',async()=>{
 const a=app();
 for(const path of ['/api/evidence/plate/photo?photoId='+P,
  '/api/evidence/plate/status?photoId='+P,
  '/api/evidence/plate/reviews?stationId='+A]){
  const res=await a.handler(req(path));
  assert.equal(res.status,403);
  assert.deepEqual(await res.json(),{error:'permission_denied'});
 }
 assert.equal(a.calls.includes('read_private_storage'),false);
});
test('authorized own QA station can read existing private plate status and photo, no writes',async()=>{
 const a=app({station:A});
 const status=await a.handler(req('/api/evidence/plate/status?photoId='+P));
 assert.equal(status.status,200);assert.equal((await status.json()).result.verified,true);
 const image=await a.handler(req('/api/evidence/plate/photo?photoId='+P));
 assert.equal(image.status,200);
 assert.match(image.headers.get('content-security-policy'),/sandbox/);
 assert.match(image.headers.get('cache-control'),/no-store/);
 assert.deepEqual(a.calls,['status','authorize_photo','read_private_storage']);
});
test('corporate identity and QA mode disabled cannot read private plate data',async()=>{
 const nonStation=app({scope:'corporate_company',role:'driver'});
 const blocked=await nonStation.handler(req('/api/evidence/plate/photo?photoId='+P));
 assert.equal(blocked.status,403);assert.equal(nonStation.calls.length,0);
 const off=app({station:A,disabled:true});
 assert.equal((await off.handler(req('/api/evidence/plate/photo?photoId='+P))).status,404);
 assert.deepEqual(off.calls,[]);
});
test('QA finance off never unlocks manual plate review write',async()=>{
 const a=app({station:A});
 const res=await a.handler(req('/api/evidence/plate/review','POST',{
  photoId:P,approved:true,observedPlate:'กข1234'
 }));
 assert.equal(res.status,404);
 assert.equal(a.calls.includes('UNSAFE_REVIEW'),false);
});
