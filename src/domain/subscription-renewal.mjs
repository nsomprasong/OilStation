/**
 * Pure renewal policy preview. Does NOT issue invoices, collect money or
 * modify module entitlements; caller must persist pricing and notice audit.
 *
 * Local billing dates YYYY-MM-DD, end-exclusive, separate from UTC instants.
 */
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function parsedDate(value){
 if(typeof value!=='string'||!DATE.test(value))throw new TypeError('invalid local billing date');
 const d=new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw new RangeError('invalid local billing date');
 return d;
}
const iso=date=>date.toISOString().slice(0,10);
const dayMs=86_400_000;
const daysInMonth=(year,month)=>new Date(Date.UTC(year,month+1,0)).getUTCDate();
function clampDay(year,month,anchor){
 return new Date(Date.UTC(year,month,Math.min(daysInMonth(year,month),anchor)));
}
export function nextSubscriptionWindow({previousEnd,billingFrequency,anchorDay}){
 const start=parsedDate(previousEnd);
 if(!['monthly','annual'].includes(billingFrequency))
  throw new TypeError('invalid billing frequency');
 if(!Number.isInteger(anchorDay)||anchorDay<1||anchorDay>31)
  throw new RangeError('anchor day must be between 1 and 31');
 const year=start.getUTCFullYear(),month=start.getUTCMonth();
 const until=billingFrequency==='monthly'?
  clampDay(year+Math.floor((month+1)/12),(month+1)%12,anchorDay):
  clampDay(year+1,month,anchorDay);
 if(until<=start)throw new RangeError('non-increasing service window');
 return {serviceStart:iso(start),serviceEnd:iso(until),billingFrequency};
}
export function reviewedRenewalPrice({
 currentPriceSatang,candidatePriceSatang,candidateEffectiveDate,
 renewalStartDate,noticeSentDate=null,minimumNoticeDays=0,
}){
 const current=currentPriceSatang,next=candidatePriceSatang;
 if(typeof current!=='bigint'||typeof next!=='bigint'||current<0n||next<0n||
  current>999_999_999_999n||next>999_999_999_999n)
  throw new RangeError('invalid price amount');
 const effective=parsedDate(candidateEffectiveDate);
 const renewal=parsedDate(renewalStartDate);
 if(!Number.isInteger(minimumNoticeDays)||minimumNoticeDays<0||minimumNoticeDays>365)
  throw new RangeError('invalid required notice');
 const sent=noticeSentDate===null?null:parsedDate(noticeSentDate);
 if(effective>renewal)return {priceSatang:current,applied:false,reason:'future_effective_date'};
 if(next>current&&minimumNoticeDays>0 &&
  (!sent||sent.getTime()>renewal.getTime()-minimumNoticeDays*dayMs))
  return {priceSatang:current,applied:false,reason:'price_increase_notice_not_met'};
 if(next>current&&(!sent||sent>renewal))
  return {priceSatang:current,applied:false,reason:'price_increase_unnotified'};
 return {priceSatang:next,applied:true,reason:'new_renewal_price'};
}
