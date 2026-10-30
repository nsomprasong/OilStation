import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCollectedCommission} from '../../src/domain/commission-preview.mjs';
import {createCommissionPreviewApi} from '../../src/api/commission-preview.mjs';
const U='11111111-1111-4111-8111-111111111111',L='22222222-2222-4222-8222-222222222222';
const ctx={invoicePaid:true,netRevenueSatang:'100000',serviceStart:'2026-10-01',
 serviceEnd:'2026-11-01',assignments:[
  {salesId:'A',from:'2026-10-01',until:'2026-10-16'},
  {salesId:'B',from:'2026-10-16',until:'2026-11-01'}],
 rules:[{id:'rA',salesId:'A',from:'2026-10-01',until:null,mode:'percent',
  amount:'10.00',payoutPolicy:'monthly'},
 {id:'rB',salesId:'B',from:'2026-10-01',until:null,mode:'percent',
  amount:'5.00',payoutPolicy:'monthly'}]};
test('paid monthly invoice splits net-of-VAT commission by effective Sales days',()=>{
 const p=previewCollectedCommission(ctx);
 assert.equal(p.status,'preview_only');assert.equal(p.payable,false);
 assert.equal(p.allocations.length,2);
 assert.equal(BigInt(p.allocations[0].basisSatang)+BigInt(p.allocations[1].basisSatang),100000n);
 assert.equal(p.totalProposedSatang,
   String(p.allocations.reduce((a,b)=>a+BigInt(b.proposedSatang),0n)));
});
test('unpaid, overlapping, annual, missing rate, excessive fixed rate fail closed',()=>{
 assert.throws(()=>previewCollectedCommission({...ctx,invoicePaid:false}),/paid/);
 assert.throws(()=>previewCollectedCommission({...ctx,serviceEnd:'2027-10-01'}),/monthly/);
 assert.throws(()=>previewCollectedCommission({...ctx,rules:[ctx.rules[0]]}),/missing/);
 assert.throws(()=>previewCollectedCommission({...ctx,rules:[...ctx.rules,ctx.rules[0]]}),/ambiguous/);
 assert.throws(()=>previewCollectedCommission({...ctx,rules:[
  {...ctx.rules[0],mode:'fixed',amount:'99999999'},
  ctx.rules[1]]}),/exceeds/);
});
test('commission context RPC requires authenticated platform actor and never posts money',async()=>{
 let calls=0;const handle=createCommissionPreviewApi({
 authenticate:async t=>t==='ok'?{id:U}:null,
 db:{platformPaidSaasCommissionContext:async d=>{calls++;assert.deepEqual(d,{
   actorId:U,invoiceLineId:L});return ctx;}},
 });
 const url='https://oilstation.goldensoft.cloud/api/platform/billing/commission-preview?invoiceLineId='+L;
 const r=await handle(new Request(url,{headers:{authorization:'Bearer ok'}}));
 assert.equal(r.status,200);assert.equal((await r.json()).preview.payable,false);
 assert.equal((await handle(new Request(url))).status,401);
 assert.equal((await handle(new Request(url.replace(L,'bad'),{
  headers:{authorization:'Bearer ok'}}))).status,400);
 assert.equal(calls,1);
});
