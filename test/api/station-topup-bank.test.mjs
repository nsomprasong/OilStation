import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptStationBankNumber,decryptStationBankNumber} from '../../src/domain/station-bank-crypto.mjs';
import {createStationBankApi} from '../../src/api/station-topup-bank.mjs';
const secret=randomBytes(32).toString('base64');
const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const account='33333333-3333-4333-8333-333333333333';
const bank='44444444-4444-4444-8444-444444444444';
const url='https://oilstation.goldensoft.cloud';
test('bank account encryption authenticates ciphertext, uses random nonce, never embeds plaintext',async()=>{
 const a=await encryptStationBankNumber('012345678901',secret);
 const b=await encryptStationBankNumber('012345678901',secret);
 assert.match(a.ciphertext,/^aes256gcm:v1:/);
 assert.equal(a.masked,'••••8901');
 assert.notEqual(a.ciphertext,b.ciphertext);
 assert.ok(!a.ciphertext.includes('012345678901'));
 assert.equal(await decryptStationBankNumber(a.ciphertext,secret),'012345678901');
 await assert.rejects(decryptStationBankNumber(a.ciphertext.replace(/.$/,'A'),secret));
 await assert.rejects(encryptStationBankNumber('1234',secret));
 await assert.rejects(encryptStationBankNumber('012345678901','bad-key'));
});
test('bank registration sends encrypted account number only to trusted adapter',async()=>{
 const calls=[];const handler=createStationBankApi({
  authenticate:async()=>({id:actor}),bankEncryptionKey:secret,
  db:{stationRegisterTopupBank:async data=>{calls.push(data);return {id:bank,accountNumberMasked:data.maskedNumber};}}
 });
 const r=await handler(new Request(url+'/api/station/topup/banks',{method:'POST',
  headers:{authorization:'Bearer token','content-type':'application/json'},
  body:JSON.stringify({stationId:station,bankCode:'KBANK',accountName:'QA Bank Receiver',
   accountNumber:'012345678901',isPrimary:true})}));
 assert.equal(r.status,201);
 assert.equal(calls.length,1);
 assert.equal(calls[0].maskedNumber,'••••8901');
 assert.ok(!JSON.stringify(calls).includes('012345678901'));
 assert.equal((await r.json()).bank.accountNumberMasked,'••••8901');
});
test('no bank encryption key never accepts account number',async()=>{
 const handler=createStationBankApi({authenticate:async()=>({id:actor}),bankEncryptionKey:null,
  db:{stationRegisterTopupBank:async()=>assert.fail('unauthorized write')}});
 const r=await handler(new Request(url+'/api/station/topup/banks',{method:'POST',
  headers:{authorization:'Bearer token','content-type':'application/json'},
  body:JSON.stringify({stationId:station,bankCode:'KBANK',accountName:'QA Bank Receiver',
   accountNumber:'012345678901',isPrimary:true})}));
 assert.equal(r.status,503);
});
test('corporate bank details require scoped adapter and never return encrypted values',async()=>{
 const encrypted=await encryptStationBankNumber('012345678901',secret);
 const calls=[];const handler=createStationBankApi({authenticate:async()=>({id:actor}),
  bankEncryptionKey:secret,db:{corporateTopupBankTransferDetails:async d=>{
   calls.push(d);return {id:bank,bankCode:'KBANK',accountName:'QA Bank Receiver',
    encryptedNumber:encrypted.ciphertext};}}});
 const r=await handler(new Request(url+'/api/topup/bank-details?accountId='+account+'&bankId='+bank,
  {headers:{authorization:'Bearer token'}}));
 assert.equal(r.status,200);
 const content=await r.text();assert.ok(!content.includes('encryptedNumber'));
 assert.ok(!content.includes('aes256gcm:v1:'));
 assert.equal(JSON.parse(content).bank.accountNumber,'012345678901');
 assert.deepEqual(calls,[{actorId:actor,accountId:account,bankId:bank}]);
});
test('missing token and unknown bank reject before trusted DB call',async()=>{
 const handler=createStationBankApi({authenticate:async()=>({id:actor}),bankEncryptionKey:secret,
  db:{corporateTopupBankTransferDetails:async()=>assert.fail('no read')}});
 const r=await handler(new Request(url+'/api/topup/bank-details?accountId=bad&bankId='+bank,
  {headers:{authorization:'Bearer token'}}));assert.equal(r.status,400);
 const noToken=await handler(new Request(url+'/api/topup/bank-details?accountId='+account+'&bankId='+bank));
 assert.equal(noToken.status,401);
});
