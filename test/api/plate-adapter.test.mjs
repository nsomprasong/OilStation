import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseAdapter} from '../../src/adapters/supabase.mjs';
const env={SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
 SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'test-only-service',
 COUPON_SIGNING_KEY:'this-is-the-test-secret-for-hmac-signing-00000'};
const uuid='11111111-1111-4111-8111-111111111111';
async function mockFetch(mock,fn){
 const original=globalThis.fetch;globalThis.fetch=mock;
 try{return await fn();}finally{globalThis.fetch=original;}
}
test('OCR context and decision are only privileged server RPC calls',async()=>{
 const seen=[];
 await mockFetch(async(url,init)=>{
  seen.push([url,JSON.parse(init.body),init.headers.authorization]);
  return new Response(JSON.stringify({path:'private.jpg',expectedPlate:'กข1234'}),{status:200});
 },async()=>{
  const db=createSupabaseAdapter(env).db;
  await db.plateOcrContext({actorId:uuid,photoId:uuid});
  await db.completePlateOcr({actorId:uuid,photoId:uuid,observedPlate:'กข1234',accepted:true});
  await db.reviewPlate({actorId:uuid,photoId:uuid,observedPlate:'กข1234',approved:true});
 });
 assert.deepEqual(seen.map(x=>x[0].split('/').pop()),['station_plate_ocr_context','complete_station_plate_ocr','review_station_plate_photo']);
 assert.ok(seen.every(x=>x[2]==='Bearer '+env.SUPABASE_SERVICE_ROLE_KEY));
});
test('photo reader accepts only scope-namespaced storage paths',async()=>{
 let fetched=false;const db=createSupabaseAdapter(env).db;
 await assert.rejects(db.readPlate('../other.jpg'),/invalid_private_path/);
 assert.equal(fetched,false);
 const path='stations/'+uuid+'/plate/'+uuid+'/'+uuid+'.jpg';
 await mockFetch(async(url,init)=>{
  fetched=true;assert.ok(url.endsWith('/storage/v1/object/oilstation-evidence/'+path));
  assert.equal(init.headers.authorization,'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY);
  return new Response(new Uint8Array(80).fill(1),{status:200});
 },async()=>assert.equal((await db.readPlate(path)).bytes.length,80));
 assert.equal(fetched,true);
});
test('review cannot turn a database-reported plate mismatch into approval',async()=>{
 await mockFetch(async()=>new Response(JSON.stringify({message:'PLATE_MISMATCH'}),{status:400}),
 async()=>{
  await assert.rejects(createSupabaseAdapter(env).db.reviewPlate({
   actorId:uuid,photoId:uuid,observedPlate:'กข9999',approved:true,
  }),{code:'PLATE_MISMATCH'});
 });
});
