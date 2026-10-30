import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const ID='11111111-1111-4111-8111-111111111111';
const endpoint='https://oilstation.goldensoft.cloud/api/bootstrap';
function deps(auth=true){
 const calls=[];
 const handle=createApi({
  authenticate:async token=>auth&&token==='valid-jwt'?{id:ID}:null,
  db:{
   memberships:async()=>[],
   bootstrapAdmin:async actor=>{calls.push(actor);return {success:true,role:'platform_superadmin'};},
  },
 });
 return {handle,calls};
}
test('first admin can bootstrap while no membership exists, using verified auth only',async()=>{
 const {handle,calls}=deps();
 const res=await handle(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer valid-jwt',origin:'https://oilstation.goldensoft.cloud'}}));
 assert.equal(res.status,200);
 assert.equal((await res.json()).role,'platform_superadmin');
 assert.deepEqual(calls,[ID]);
});
test('missing/bad token or cross-origin request cannot bootstrap',async()=>{
 const {handle,calls}=deps();
 assert.equal((await handle(new Request(endpoint,{method:'POST'}))).status,401);
 assert.equal((await handle(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer bad-jwt'}}))).status,401);
 assert.equal((await handle(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer valid-jwt',origin:'https://attacker.invalid'}}))).status,403);
 assert.equal(calls.length,0);
});
test('bootstrap cannot be triggered by GET',async()=>{
 const {handle,calls}=deps();
 assert.equal((await handle(new Request(endpoint,{method:'GET',headers:{authorization:'Bearer valid-jwt'}}))).status,405);
 assert.equal(calls.length,0);
});
