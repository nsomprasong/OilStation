import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalletIntegrityApi} from '../../src/api/wallet-integrity.mjs';
const U='11111111-1111-4111-8111-111111111111';
const A='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
const root='https://oilstation.goldensoft.cloud/api/corporate/wallet-integrity?accountId='+A;
const report={accountId:A,readOnly:true,bankReconciled:false,healthy:true,status:'balanced'};
const setup=(denied=false)=>{
 const args=[];return {args,api:createWalletIntegrityApi({
 authenticate:async t=>t==='good'?{id:U}:null,
 db:{walletIntegrity:async data=>{args.push(data);if(denied)throw {code:'FORBIDDEN'};return report;}},
 })};
};
test('read-only corporate wallet snapshot requires token and server role scope',async()=>{
 const x=setup();
 const res=await x.api(new Request(root,{headers:{authorization:'Bearer good'}}));
 assert.equal(res.status,200);
 assert.deepEqual((await res.json()).integrity,report);
 assert.deepEqual(x.args,[{actorId:U,accountId:A}]);
 assert.equal((await x.api(new Request(root))).status,401);
 assert.equal((await x.api(new Request(root.replace(A,'invalid'),{
  headers:{authorization:'Bearer good'}}))).status,400);
});
test('no cross-account data when database denies and no mutating method',async()=>{
 const x=setup(true);
 assert.equal((await x.api(new Request(root,{headers:{authorization:'Bearer good'}}))).status,403);
 assert.equal((await x.api(new Request(root,{method:'POST',
  headers:{authorization:'Bearer good'}}))).status,405);
});
