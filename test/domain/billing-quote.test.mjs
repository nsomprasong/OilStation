import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteSubscription} from '../../src/domain/billing-quote.mjs';
const lines=[{moduleCode:'qr_coupon',quantity:2,unitPriceSatang:150000n}];
const tax={mode:'exclusive',rateBasisPoints:700};
test('card pays list price and QR PromptPay gets 2% discount before VAT',()=>{
 const card=quoteSubscription({lines,paymentMethod:'card',tax});
 assert.equal(card.subtotalSatang,300000n);
 assert.equal(card.discountSatang,0n);
 assert.equal(card.totalSatang,321000n);
 const qr=quoteSubscription({lines,paymentMethod:'promptpay',tax});
 assert.equal(qr.qrDiscountSatang,6000n);
 assert.equal(qr.taxSatang,20580n);
 assert.equal(qr.totalSatang,314580n);
});
test('promotion applied before QR discount without negative invoices',()=>{
 const promo={type:'fixed',amountSatang:500000n};
 const q=quoteSubscription({lines,promotion:promo,paymentMethod:'promptpay',tax});
 assert.equal(q.promotionDiscountSatang,300000n);
 assert.equal(q.totalSatang,0n);
});
test('tax-inclusive quote does not accidentally tax twice',()=>{
 const quoted=quoteSubscription({lines,paymentMethod:'card',
   tax:{mode:'inclusive',rateBasisPoints:700}});
 assert.equal(quoted.totalSatang,300000n);
 assert.ok(quoted.taxSatang>0n);
});
test('tax policy, satang precision, and overflow must fail closed',()=>{
 assert.throws(()=>quoteSubscription({lines,paymentMethod:'card'}),/tax configuration/);
 assert.throws(()=>quoteSubscription({lines:[{...lines[0],unitPriceSatang:100.1}],paymentMethod:'card',tax}),/price/);
 assert.throws(()=>quoteSubscription({lines,paymentMethod:'cash',tax}),/payment method/);
 assert.throws(()=>quoteSubscription({lines,promotion:{type:'percent',basisPoints:10001},paymentMethod:'card',tax}),/promotion rate/);
 assert.throws(()=>quoteSubscription({lines:[{...lines[0],quantity:100001}],paymentMethod:'card',tax}),/quantity/);
});
