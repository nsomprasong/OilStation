import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createStationBankApi} from '../../src/api/station-topup-bank.mjs';
import {encryptStationBankNumber} from '../../src/domain/station-bank-crypto.mjs';
import {promptPayCrc} from '../../src/domain/promptpay.mjs';
const key=randomBytes(32).toString('base64');
const actor='11111111-1111-4111-8111-111111111111';
const account='22222222-2222-4222-8222-222222222222';
const station='33333333-3333-4333-8333-333333333333';
const bank='44444444-4444-4444-8444-444444444444';
const origin='https://oilstation.goldensoft.cloud';
const request=(path,token=true,init={})=>new Request(origin+path,{
 ...init,headers:{...(token?{authorization:'Bearer valid'}:{}),...(init.headers||{})},
});
const mock=async(bankCode='PROMPTPAY',recipient='0812345678')=>{
 const secured=await encryptStationBankNumber(recipient,key),calls=[];
 const db={
  canUploadTopup:async d=>{calls.push(['amount',d]);if(d.amountSatang!=='150000')throw {code:'INVALID_REQUEST'};},
  corporateTopupBankTransferDetails:async d=>{calls.push(['bank',d]);return {
   id:bank,bankCode,accountName:'QA Recipient',encryptedNumber:secured.ciphertext};},
  corporateTopupAmountOptions:async d=>['100000','150000'],
  stationGetTopupAmountOptions:async d=>['100000','150000'],
  stationSetTopupAmountOptions:async d=>{calls.push(['save',d]);return {saved:true};},
 };
 return {calls,handler:createStationBankApi({authenticate:async()=>({id:actor}),
  bankEncryptionKey:key,db})};
};
test('PromptPay QR is amount-locked and has valid CRC with phone receiver',async()=>{
 const {handler,calls}=await mock();
 const res=await handler(request('/api/topup/payment-instructions?accountId='+account+
  '&bankId='+bank+'&amountSatang=150000'));
 assert.equal(res.status,200);
 const p=(await res.json()).payment;
 assert.equal(p.method,'promptpay');
 assert.equal(p.amountSatang,'150000');
 assert.ok(p.qrPayload.includes('54071500.00'));
 assert.ok(p.qrPayload.includes('0066812345678'));
 assert.equal(p.qrPayload.slice(-4),promptPayCrc(p.qrPayload.slice(0,-4)));
 assert.ok(!JSON.stringify(p).includes('encryptedNumber'));
 assert.equal(calls[0][0],'amount');
});
test('station without PromptPay exposes real bank recipient with no artificial QR',async()=>{
 const {handler}=await mock('KBANK','012345678901');
 const res=await handler(request('/api/topup/payment-instructions?accountId='+account+
  '&bankId='+bank+'&amountSatang=150000'));
 assert.equal(res.status,200);
 const p=(await res.json()).payment;
 assert.equal(p.method,'bank_transfer');
 assert.equal(p.bankCode,'KBANK');
 assert.equal(p.accountName,'QA Recipient');
 assert.equal(p.accountNumber,'012345678901');
 assert.ok(!Object.hasOwn(p,'qrPayload'));
});
test('changed amount and missing authorization rejected before returning payment instructions',async()=>{
 const {handler,calls}=await mock();
 const changed=await handler(request('/api/topup/payment-instructions?accountId='+account+
  '&bankId='+bank+'&amountSatang=999900'));
 assert.equal(changed.status,400);
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],'amount');
 const anon=await handler(request('/api/topup/payment-instructions?accountId='+account+
  '&bankId='+bank+'&amountSatang=150000',false));
 assert.equal(anon.status,401);
});
test('owner only saves valid preset amounts, not free-form arbitrary amounts',async()=>{
 const {handler,calls}=await mock();
 const post=body=>handler(request('/api/station/topup/amount-options',true,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post({stationId:station,amounts:['100000','150000']})).status,200);
 assert.equal(calls.at(-1)[0],'save');
 for(const amounts of [['100000','100000'],[],['99'],['0'],['150000','1e9']]){
  assert.equal((await post({stationId:station,amounts})).status,400);
 }
});
test('PromptPay recipient validation protects registration from invalid account numbers',async()=>{
 let received=false;
 const handler=createStationBankApi({authenticate:async()=>({id:actor}),
  bankEncryptionKey:key,db:{stationRegisterTopupBank:async()=>{received=true;return {};}}});
 const r=await handler(request('/api/station/topup/banks',true,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({stationId:station,bankCode:'PROMPTPAY',accountName:'QA',
   accountNumber:'0212345678',isPrimary:true})}));
 assert.equal(r.status,400);
 assert.equal(received,false);
});
