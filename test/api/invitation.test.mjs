import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const USER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH';
const url = 'https://oilstation.goldensoft.cloud/api/invitations/accept';
const headers = { authorization: 'Bearer verified', 'content-type':'application/json' };
const req = (token, options={}) => new Request(url, {
  method:'POST', headers:{...headers,...(options.headers||{})}, body:JSON.stringify({ token }),
});
const create = () => {
  const calls = [];
  const handle=createApi({
    authenticate: async token => token === 'verified' ? { id: USER } : null,
    db: {
      memberships: async () => [], // no membership until invitation is accepted
      acceptInvitation: async data => { calls.push(data); return { accepted:true, role_code:'attendant' }; },
    },
  });
  return { handle, calls };
};
test('new verified user with zero memberships may accept a valid single-use invitation',async()=>{
  const {handle,calls}=create();
  const res=await handle(req(TOKEN));
  assert.equal(res.status,200);
  assert.equal((await res.json()).accepted,true);
  assert.deepEqual(calls,[{actorId:USER,token:TOKEN}]);
});
test('anonymous users cannot redeem invitations',async()=>{
  const {handle,calls}=create();
  const res=await handle(req(TOKEN,{headers:{authorization:'Bearer incorrect'}}));
  assert.equal(res.status,401);
  assert.equal(calls.length,0);
});
test('short, malformed or missing invitation tokens are rejected',async()=>{
  const {handle,calls}=create();
  assert.equal((await handle(req('short'))).status,400);
  assert.equal((await handle(req('😃'.repeat(64)))).status,400);
  assert.equal(calls.length,0);
});
test('cross-site attempts to redeem invitations are refused',async()=>{
  const {handle,calls}=create();
  const res=await handle(req(TOKEN,{headers:{origin:'https://attacker.example'}}));
  assert.equal(res.status,403);
  assert.equal(calls.length,0);
});
