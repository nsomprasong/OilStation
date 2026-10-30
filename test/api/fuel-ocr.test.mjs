import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFuelOcrPreview} from '../../src/domain/fuel-ocr.mjs';
import {createFuelOcrApi} from '../../src/api/fuel-ocr.mjs';
const E='11111111-1111-4111-8111-111111111111',U='22222222-2222-4222-8222-222222222222';
const url='https://oilstation.goldensoft.cloud/api/evidence/fuel/ocr';
test('Thai digit meter and receipt OCR return exact decimal previews, never approval',()=>{
 const pump=parseFuelOcrPreview({kind:'pump_display',text:'ปริมาณ ๓๑.๕๐๐ ลิตร\nยอด 1,102.50 บาท',confidence:.99});
 assert.deepEqual([pump.liters,pump.grossSatang,pump.status,pump.verified],['31.500','110250','needs_human_review',false]);
 const receipt=parseFuelOcrPreview({kind:'receipt',text:'รวม 1,102.50 บาท',confidence:.99});
 assert.equal(receipt.liters,null);assert.equal(receipt.grossSatang,'110250');assert.equal(receipt.verified,false);
});
test('ambiguous values, low confidence and missing units never auto approve',()=>{
 const p=parseFuelOcrPreview({kind:'pump_display',text:'10.000 ลิตร\n11.000 ลิตร\n100 บาท\n200 บาท',confidence:.99});
 assert.equal(p.liters,null);assert.equal(p.grossSatang,null);
 assert.equal(parseFuelOcrPreview({kind:'receipt',text:'1100',confidence:null}).verified,false);
 assert.equal(parseFuelOcrPreview({kind:'receipt',text:'1100',confidence:null}).grossSatang,null);
});
function app({authorized=true}={}){
 const calls=[];const handler=createFuelOcrApi({
 authenticate:async t=>t==='good'?{id:U}:null,
 db:{
  fuelOcrContext:async d=>{calls.push(['context',d]);if(!authorized)throw {code:'FORBIDDEN'};return {kind:'pump_display',path:'private/evidence.jpg'};},
  readFuelPhoto:async path=>{calls.push(['read',path]);return {bytes:new Uint8Array(100),contentType:'image/jpeg'};},
  recordFuelOcr:async d=>{calls.push(['save',d]);return {evidenceId:E};},
 },
 recognize:async()=>({text:'20.000 ลิตร 700.00 บาท',confidence:.99}),
 });return {calls,handler};
}
const req=(data={evidenceId:E},headers={})=>new Request(url,{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer good',...headers},
 body:JSON.stringify(data)});
test('authorized OCR reads stored object from DB, stores preview without settlement',async()=>{
 const a=app();const r=await a.handler(req());
 assert.equal(r.status,200);const response=await r.json();
 assert.equal(response.preview.grossSatang,'70000');
 assert.equal(response.preview.verified,false);
 assert.deepEqual(a.calls.map(x=>x[0]),['context','read','save']);
 assert.deepEqual(a.calls[0][1],{actorId:U,evidenceId:E});
});
test('request cannot override OCR, kind or trusted storage path',async()=>{
 const a=app();
 for(const extra of [{kind:'receipt'},{path:'public.jpg'},{amountSatang:'1'},{verified:true}]){
  assert.equal((await a.handler(req({evidenceId:E,...extra}))).status,400);
 }
 assert.equal(a.calls.length,0);
 const b=app({authorized:false});
 assert.equal((await b.handler(req())).status,403);
 assert.deepEqual(b.calls.map(x=>x[0]),['context']);
});
