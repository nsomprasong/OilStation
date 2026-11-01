import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPromptPayPayload,normalizePromptPay,promptPayCrc,maskManualAccount}
 from '../../src/domain/promptpay.mjs';
import {planAdvanceInstallments} from '../../src/domain/advance-installments.mjs';

test('BOT PromptPay phone static identity with amount generates official-compatible TLV and CRC',()=>{
 const payload=buildPromptPayPayload({type:'promptpay_phone',recipient:'0812345678',amountSatang:10000});
 assert.equal(payload,'00020101021229370016A000000677010111011300668123456785802TH53037645406100.006304BB8A');
 assert.equal(promptPayCrc(payload.slice(0,-4)),payload.slice(-4));
});
test('national-ID receiving QR and exact stang amount do not round',()=>{
 const payload=buildPromptPayPayload({type:'promptpay_national_id',
  recipient:'1234567890123',amountSatang:101});
 assert.match(payload,/02131234567890123/);
 assert.match(payload,/54041\.01/);
 assert.equal(promptPayCrc(payload.slice(0,-4)),payload.slice(-4));
});
test('malformed PromptPay IDs and arbitrary bank accounts never produce PromptPay QR',()=>{
 for(const recipient of ['1234','099','0112345678','<script>','00123456789']){
  assert.throws(()=>buildPromptPayPayload({type:'promptpay_phone',recipient,amountSatang:100}),/invalid/);
 }
 assert.throws(()=>buildPromptPayPayload({type:'bank_account',recipient:'1234567890',amountSatang:100}),/unsupported/);
 assert.throws(()=>buildPromptPayPayload({type:'promptpay_phone',recipient:'0812345678',amountSatang:0}),/amount/);
 assert.throws(()=>buildPromptPayPayload({type:'promptpay_phone',recipient:'0812345678',amountSatang:10.5}),/amount/);
 assert.equal(maskManualAccount('bank_account','123-456-7890'),'••••7890');
 assert.equal(normalizePromptPay('promptpay_phone','081-234-5678').value,'0066812345678');
});
test('advance amortization totals exactly, with remainder in last installment',()=>{
 const plan=planAdvanceInstallments({principalSatang:10001,installments:3,
  firstDeductionDate:'2026-12-15',frequency:'monthly'});
 assert.deepEqual(plan.map(x=>x.amountSatang),[3333,3333,3335]);
 assert.deepEqual(plan.map(x=>x.date),['2026-12-15','2027-01-15','2027-02-15']);
 assert.ok(plan.every(p=>p.status==='planned_only'));
});
test('monthly 31st clamps for February but recovers March 31st',()=>{
 const dates=planAdvanceInstallments({principalSatang:30000,installments:3,
  firstDeductionDate:'2027-01-31',frequency:'monthly'}).map(x=>x.date);
 assert.deepEqual(dates,['2027-01-31','2027-02-28','2027-03-31']);
});
test('semi monthly starts on 15th or payroll month end and crosses year',()=>{
 const p=planAdvanceInstallments({principalSatang:40000,installments:4,
  firstDeductionDate:'2026-11-30',frequency:'semi_monthly'});
 assert.deepEqual(p.map(x=>x.date),['2026-11-30','2026-12-15','2026-12-31','2027-01-15']);
 assert.throws(()=>planAdvanceInstallments({principalSatang:20000,installments:2,
  firstDeductionDate:'2026-12-20',frequency:'semi_monthly'}),/semi-monthly/);
});
test('weekly advance first deduct at chosen pay date then every 7 days',()=>{
 const p=planAdvanceInstallments({principalSatang:9000,installments:3,
  firstDeductionDate:'2026-12-30',frequency:'weekly'});
 assert.deepEqual(p.map(x=>x.date),['2026-12-30','2027-01-06','2027-01-13']);
});
test('invalid installment count, start date, money and wage frequency fail closed',()=>{
 for(const installments of [0,25,-1,1.5]){
  assert.throws(()=>planAdvanceInstallments({principalSatang:20000,installments,
   firstDeductionDate:'2026-12-15',frequency:'monthly'}));
 }
 for(const firstDeductionDate of ['2026-02-30','2026-13-10','bad']){
  assert.throws(()=>planAdvanceInstallments({principalSatang:20000,installments:2,
   firstDeductionDate,frequency:'monthly'}));
 }
 assert.throws(()=>planAdvanceInstallments({principalSatang:0,installments:2,
  firstDeductionDate:'2026-12-15',frequency:'monthly'}));
 assert.throws(()=>planAdvanceInstallments({principalSatang:20000,installments:2,
  firstDeductionDate:'2026-12-15',frequency:'hourly'}));
});
