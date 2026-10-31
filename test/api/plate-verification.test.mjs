import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlate} from '../../src/domain/plate-ocr.mjs';
import {createPlateVerificationApi} from '../../src/api/plate-verification.mjs';
const USER='11111111-1111-4111-8111-111111111111',PHOTO='44444444-4444-4444-8444-444444444444';
const origin='https://oilstation.goldensoft.cloud';
function app({denied=false}={}){
 const calls=[];
 const handle=createPlateVerificationApi({
  authenticate:async token=>token==='good'?{id:USER}:null,
  db:{
   platePhotoStatus:async data=>{calls.push(['status',data]);
    if(denied)throw {code:'FORBIDDEN'};
    return {photoId:PHOTO,status:'verified_supervisor',verified:true};
   },
   reviewPlate:async data=>{calls.push(['review',data]);
    if(denied)throw {code:'FORBIDDEN'};
    return {status:data.approved?'verified_supervisor':'rejected',verified:data.approved};
   }
  }
 });
 return {handle,calls};
}
function req(path,body,headers={}){
 return new Request(origin+path,{method:'POST',headers:{
  authorization:'Bearer good','content-type':'application/json',...headers
 },body:JSON.stringify(body)});
}
test('Thai number normalization stays exact for human photo review',()=>{
 assert.equal(normalizePlate(' กข-๑๒๓๔ '),'กข1234');
 assert.equal(normalizePlate('กข1235'),'กข1235');
});
test('OCR route removed; no recognizer or DB used',async()=>{
 const a=app();
 const r=await a.handle(req('/api/evidence/plate/ocr',{photoId:PHOTO}));
 assert.equal(r.status,410);
 assert.equal((await r.json()).error,'ocr_removed_use_photo_review');
 assert.deepEqual(a.calls,[]);
});
test('station-scope photo approval status allows uploader to continue after separate reviewer',async()=>{
 const a=app();
 const r=await a.handle(new Request(origin+'/api/evidence/plate/status?photoId='+PHOTO,{
  headers:{authorization:'Bearer good'}}));
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).result,{photoId:PHOTO,status:'verified_supervisor',verified:true});
 assert.deepEqual(a.calls.map(c=>c[0]),['status']);
 const forbidden=app({denied:true});
 assert.equal((await forbidden.handle(new Request(origin+'/api/evidence/plate/status?photoId='+PHOTO,{
  headers:{authorization:'Bearer good'}}))).status,403);
});
test('review requires matching normalized plate, actor identity and explicit approval',async()=>{
 const a=app();
 assert.equal((await a.handle(req('/api/evidence/plate/review',{
  photoId:PHOTO,approved:true,observedPlate:''}))).status,400);
 assert.equal((await a.handle(req('/api/evidence/plate/review',{
  photoId:PHOTO,approved:true,observedPlate:'กข ๑๒๓๔'}))).status,200);
 assert.equal(a.calls[0][1].observedPlate,'กข1234');
 assert.equal(a.calls[0][1].actorId,USER);
 assert.equal((await a.handle(req('/api/evidence/plate/review',{
  photoId:PHOTO,approved:true,observedPlate:'กข ๑๒๓๔'},{
  origin:'https://evil.example'}))).status,403);
 assert.equal((await a.handle(req('/api/evidence/plate/review',{
  photoId:PHOTO,approved:false},{authorization:'Bearer wrong'}))).status,401);
 const b=app({denied:true});
 assert.equal((await b.handle(req('/api/evidence/plate/review',{
  photoId:PHOTO,approved:true,observedPlate:'กข1234'}))).status,403);
});
