import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaOperationsApi} from '../../src/api/qa-operations.mjs';
import {createQaTopupSimulationApi} from '../../src/api/qa-topup-simulation.mjs';

const BASE='https://oilstation.goldensoft.cloud';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const COMPANY='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
const ACCOUNT='07de207d-97cd-4f46-9683-d431d057c583';
const FOREIGN='e42cf203-bd1e-43b4-b5bf-18b262b838ab';
const ACTOR='11111111-1111-4111-8111-111111111111';
const stationIds=[STATION,'76388e2c-ef36-4656-808b-7d0fbd1d2c35',
 '24dc4981-0e6f-4b86-bfd7-03717002d0be','02183a4e-47b0-4575-9f4f-74cec6553205'];
const companyIds=[COMPANY,...Array.from({length:11},(_,i)=>
 '00000000-0000-4000-8000-'+String(i+201).padStart(12,'0'))];
const env={
 OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_MODE_ENABLED:'true',OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:stationIds.join(','),
 OILSTATION_QA_COMPANY_IDS:companyIds.join(','),
 OILSTATION_QA_FINANCE_SIM_ENABLED:'false',
};
const request=(path,body)=>new Request(BASE+path,{
 method:body?'POST':'GET',headers:{authorization:'Bearer protected_qa',
  ...(body?{origin:BASE,'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{}),
});
const app=(scope='corporate_company',role='corporate_admin')=>{
 const calls=[];
 const authenticate=async()=>({id:ACTOR,isQa:true});
 const db={memberships:async()=>[{active:true,scope_type:scope,role_code:role,
   corporate_company_id:COMPANY,station_id:STATION}],
  walletIntegrity:async({actorId,accountId})=>{
   calls.push('wallet:'+accountId);assert.equal(actorId,ACTOR);
   if(accountId===FOREIGN)throw {code:'FORBIDDEN'};
   return {accountId:ACCOUNT,readOnly:true,bankReconciled:false,
    healthy:true,status:'balanced'};
  },
  inspectQr:async()=>{calls.push('UNSAFE_SCAN');throw Error('must never inspect QR');},
  qaPendingTopups:async()=>{calls.push('UNSAFE_TOPUP');throw Error('must never query topups');},
 };
 return {calls,ops:createQaOperationsApi({env,authenticate,db}),
  topup:createQaTopupSimulationApi({env,authenticate,db})};
};

test('QA finance-disabled wallet: own readonly 200, foreign 403, never writes',async()=>{
 const q=app();
 const own=await q.ops(request('/api/corporate/wallet-integrity?accountId='+ACCOUNT));
 assert.equal(own.status,200);
 const data=(await own.json()).integrity;
 assert.equal(data.readOnly,true);assert.equal(data.bankReconciled,false);
 const denied=await q.ops(request('/api/corporate/wallet-integrity?accountId='+FOREIGN));
 assert.equal(denied.status,403);
 assert.deepEqual(await denied.json(),{error:'permission_denied'});
 assert.deepEqual(q.calls,['wallet:'+ACCOUNT,'wallet:'+FOREIGN]);
});

test('invalid QA QR shape 400, signed-shaped QR 503 never inspect/settle',async()=>{
 const q=app('station','cashier');
 for(const qrPayload of ['NOT-A-SIGNED-QR','00000000-0000-4000-8000-000000000000.INVALID_SIG','']){
  const invalid=await q.ops(request('/api/station/scan-qr',{qrPayload}));
  assert.equal(invalid.status,400);
  assert.deepEqual(await invalid.json(),{error:'invalid_qr'});
 }
 const signed='00000000-0000-4000-8000-000000000000.'+'0'.repeat(64);
 const blocked=await q.ops(request('/api/station/scan-qr',{qrPayload:signed}));
 assert.equal(blocked.status,503);
 assert.deepEqual(await blocked.json(),{error:'qa_finance_disabled'});
 const notStaff=app();
 assert.equal((await notStaff.ops(request('/api/station/scan-qr',{qrPayload:'BAD'}))).status,403);
 assert.equal(q.calls.includes('UNSAFE_SCAN'),false);
});

test('QA driver denied topup pending and banks before finance gate or DB read',async()=>{
 const driver=app('corporate_company','driver');
 const pending=await driver.topup(request('/api/qa/finance/topup/pending?stationId='+STATION));
 assert.equal(pending.status,403);
 assert.deepEqual(await pending.json(),{error:'permission_denied'});
 const banks=await driver.ops(request('/api/topup/banks?accountId='+ACCOUNT));
 assert.equal(banks.status,403);
 assert.deepEqual(await banks.json(),{error:'permission_denied'});
 const owner=app('station','station_owner');
 const noAccess=await owner.topup(request('/api/qa/finance/topup/pending?stationId='+STATION));
 assert.equal(noAccess.status,404);
 assert.deepEqual([...driver.calls,...owner.calls],[]);
});
