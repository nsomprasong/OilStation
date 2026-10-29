import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSubscriptionWindow,reviewedRenewalPrice} from '../../src/domain/subscription-renewal.mjs';
test('monthly 31st anchor recovers after February and handles leap February',()=>{
 const feb=nextSubscriptionWindow({previousEnd:'2027-01-31',
   billingFrequency:'monthly',anchorDay:31});
 assert.deepEqual(feb,{serviceStart:'2027-01-31',serviceEnd:'2027-02-28',
  billingFrequency:'monthly'});
 const march=nextSubscriptionWindow({previousEnd:feb.serviceEnd,
   billingFrequency:'monthly',anchorDay:31});
 assert.equal(march.serviceEnd,'2027-03-31');
 const leap=nextSubscriptionWindow({previousEnd:'2028-01-31',
   billingFrequency:'monthly',anchorDay:31});
 assert.equal(leap.serviceEnd,'2028-02-29');
});
test('annual Feb29 anchor clamps until leap year without losing anchor',()=>{
 const period=nextSubscriptionWindow({previousEnd:'2028-02-29',
   billingFrequency:'annual',anchorDay:29});
 assert.equal(period.serviceEnd,'2029-02-28');
 const leap=nextSubscriptionWindow({previousEnd:'2031-02-28',
   billingFrequency:'annual',anchorDay:29});
 assert.equal(leap.serviceEnd,'2032-02-29');
});
test('price change affects a new renewal only after effective date and advance notice',()=>{
 const params={currentPriceSatang:10000n,candidatePriceSatang:12000n,
  renewalStartDate:'2026-11-01',candidateEffectiveDate:'2026-11-01',
  minimumNoticeDays:14};
 assert.deepEqual(reviewedRenewalPrice({...params,noticeSentDate:'2026-10-01'}),
   {priceSatang:12000n,applied:true,reason:'new_renewal_price'});
 assert.equal(reviewedRenewalPrice({...params,noticeSentDate:'2026-10-25'}).applied,false);
 assert.equal(reviewedRenewalPrice({...params,noticeSentDate:null}).applied,false);
 assert.equal(reviewedRenewalPrice({...params,candidateEffectiveDate:'2026-12-01',
    noticeSentDate:'2026-10-01'}).reason,'future_effective_date');
});
test('discounts can apply at next renewal, but never retroactively',()=>{
 const r=reviewedRenewalPrice({currentPriceSatang:10000n,candidatePriceSatang:9000n,
   renewalStartDate:'2026-11-01',candidateEffectiveDate:'2026-11-01',
   minimumNoticeDays:30});
 assert.equal(r.priceSatang,9000n);
});
test('invalid dates, anchor and monetary input fail closed',()=>{
 assert.throws(()=>nextSubscriptionWindow({previousEnd:'2026-02-30',
  billingFrequency:'monthly',anchorDay:30}),/invalid/);
 assert.throws(()=>nextSubscriptionWindow({previousEnd:'2026-03-01',
  billingFrequency:'monthly',anchorDay:0}),/anchor/);
 assert.throws(()=>reviewedRenewalPrice({currentPriceSatang:100,
  candidatePriceSatang:9000n,candidateEffectiveDate:'2026-11-01',
  renewalStartDate:'2026-11-01'}),/amount/);
});
