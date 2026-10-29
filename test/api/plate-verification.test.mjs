import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlate,extractPlateCandidates,evaluatePlateOcr} from '../../src/domain/plate-ocr.mjs';
import {createGoogleVisionRecognizer} from '../../src/adapters/google-vision.mjs';
import {createPlateVerificationApi} from '../../src/api/plate-verification.mjs';
const USER='11111111-1111-4111-8111-111111111111', PHOTO='44444444-4444-4444-8444-444444444444';
const path='https://oilstation.goldensoft.cloud/api/evidence/plate/ocr';
const image={bytes:new Uint8Array(100).fill(1),contentType:'image/png'};
test('Thai digits, punctuation and spaces normalize without fuzzy comparisons',()=>{
 assert.equal(normalizePlate(' กข-๑๒๓๔ '),'กข1234');
 assert.deepEqual(extractPlateCandidates('กข 1234\nกรุงเทพมหานคร'),['กข1234']);
 assert.deepEqual(extractPlateCandidates('กข12345'),[]);
 assert.equal(evaluatePlateOcr({text:'กข 1235',confidence:.99,expectedPlate:'กข1234'}).verified,false);
});
test('ambiguous plate, low confidence and no recognized plate fail closed',()=>{
 for(const [text,confidence] of [['กข1234\nกข9999',.99],['กข1234',.9],['ไม่มีทะเบียน',.99]]){
  assert.equal(evaluatePlateOcr({text,confidence,expectedPlate:'กข1234'}).verified,false);
 }
 assert.equal(evaluatePlateOcr({text:'กข1234',confidence:.98,expectedPlate:'กข 1234'}).verified,true);
});
test('Google Vision OCR sends private image only to fixed endpoint with secret header',async()=>{
 const requests=[];
 const recognize=createGoogleVisionRecognizer('test-only-secret-key',{fetchImpl:async(url,init)=>{
  requests.push({url,init});
  return new Response(JSON.stringify({responses:[{fullTextAnnotation:{
   text:'กข 1234',pages:[{blocks:[{paragraphs:[{words:[{confidence:.97}]}]}]}],
  }}]}),{status:200});
 }});
 const out=await recognize(image);
 assert.equal(out.text,'กข 1234');assert.equal(out.confidence,.97);
 assert.equal(requests[0].url,'https://vision.googleapis.com/v1/images:annotate');
 assert.equal(requests[0].init.headers['x-goog-api-key'],'test-only-secret-key');
 assert.equal(JSON.parse(requests[0].init.body).requests[0].features[0].type,'DOCUMENT_TEXT_DETECTION');
});
test('Google Vision error or missing word confidence cannot authorize photo',async()=>{
 const r=createGoogleVisionRecognizer('test-only-secret-key',{fetchImpl:async()=>new Response(
 JSON.stringify({responses:[{fullTextAnnotation:{text:'กข1234'}}]}),{status:200})});
 assert.equal((await r(image)).confidence,null);
 const bad=createGoogleVisionRecognizer('test-only-secret-key',{fetchImpl:async()=>new Response('{}',{status:429})});
 await assert.rejects(bad(image),/ocr_provider_unavailable/);
});
function app(opts={}){
 const calls=[];const handler=createPlateVerificationApi({
 authenticate:async token=>token==='good'?{id:USER}:null,
 db:{
  plateOcrContext:async d=>{calls.push(['context',d]);if(opts.denied)throw {code:'FORBIDDEN'};return {path:'private/path.jpg',expectedPlate:'กข1234'};},
  readPlate:async p=>{calls.push(['read',p]);return image;},
  completePlateOcr:async d=>{calls.push(['complete',d]);return {verified:d.accepted,status:d.accepted?'verified_ocr':'pending_review'};},
  reviewPlate:async d=>{calls.push(['review',d]);return {status:d.approved?'verified_supervisor':'rejected'};},
 },
 recognize:async()=>({text:opts.text||'กข 1234',confidence:opts.confidence??.98}),
 });
 return {calls,handler};
}
const req=(url=path,body={photoId:PHOTO},headers={})=>new Request(url,{method:'POST',headers:{
 'content-type':'application/json',authorization:'Bearer good',...headers},body:JSON.stringify(body)});
test('attested OCR calls scoped DB context before private photo read, then updates once',async()=>{
 const a=app();const r=await a.handler(req());assert.equal(r.status,200);
 assert.equal((await r.json()).result.verified,true);
 assert.deepEqual(a.calls.map(c=>c[0]),['context','read','complete']);
 assert.equal(a.calls[2][1].observedPlate,'กข1234');
});
test('OCR mismatch never requests verified state',async()=>{
 const a=app({text:'กข1235'});const r=await a.handler(req());
 assert.equal((await r.json()).result.verified,false);
 assert.equal(a.calls[2][1].accepted,false);
});
test('unauthenticated, cross-origin, malformed payload and wrong station scope deny before storage',async()=>{
 const a=app();
 assert.equal((await a.handler(req(path,{photoId:PHOTO},{authorization:'Bearer no'}))).status,401);
 assert.equal((await a.handler(req(path,{photoId:PHOTO},{origin:'https://evil.example'}))).status,403);
 assert.equal((await a.handler(req(path,{photoId:'wrong'}))).status,400);
 assert.equal(a.calls.length,0);
 const b=app({denied:true});
 assert.equal((await b.handler(req())).status,403);
 assert.deepEqual(b.calls.map(c=>c[0]),['context']);
});
test('supervisor review requires explicit decision and does not bypass DB validation',async()=>{
 const a=app();const url='https://oilstation.goldensoft.cloud/api/evidence/plate/review';
 assert.equal((await a.handler(req(url,{photoId:PHOTO,approved:true,observedPlate:''}))).status,400);
 assert.equal((await a.handler(req(url,{photoId:PHOTO,approved:true,observedPlate:'กข ๑๒๓๔'}))).status,200);
 assert.deepEqual(a.calls.map(c=>c[0]),['review']);
 assert.equal(a.calls[0][1].observedPlate,'กข1234');
});
