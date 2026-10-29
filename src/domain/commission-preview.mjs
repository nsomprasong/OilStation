import {allocateCommission} from './commission.mjs';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const satang=value=>{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,11})$/.test(value))
  throw new TypeError('invalid net revenue');
 return BigInt(value);
};
const day=value=>{
 if(typeof value!=='string'||!DATE.test(value))throw new TypeError('invalid date');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)
  throw new TypeError('invalid date');
 return Number(date.getTime()/86400000);
};
function hundredths(v,max){
 if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(v))
  throw new RangeError('invalid commission rule amount');
 const [whole,dec='']=v.split('.');
 const scaled=BigInt(whole)*100n+BigInt(dec.padEnd(2,'0'));
 if(scaled>max)throw new RangeError('commission rate exceeds reviewed policy');
 return scaled;
}
const round=(amount,numerator,denominator)=>
 (amount*numerator+denominator/2n)/denominator;
/** For reporting ONLY: never creates earned ledger or a payout.
 * Only calendar-day-aligned monthly subscriptions are supported.
 * Annual upfront/prepay, refunds, reassignment retroactivity need separate review.
 */
export function previewCollectedCommission({invoicePaid,netRevenueSatang,
 serviceStart,serviceEnd,assignments,rules}){
 if(invoicePaid!==true)throw new Error('paid SaaS invoice required');
 const basis=satang(netRevenueSatang);
 const from=day(serviceStart),until=day(serviceEnd);
 if(until<=from||until-from>35)throw new RangeError('monthly-only review');
 if(!Array.isArray(assignments)||!assignments.length||
   !Array.isArray(rules)||!rules.length)throw new Error('assignment and rule required');
 const shares=allocateCommission({paid:true,monthlyAmountSatang:basis,
  startDate:serviceStart,endDate:serviceEnd,assignments});
 const overallDays=BigInt(until-from);
 let total=0n;
 const previews=shares.map((share,i)=>{
  const a=[...assignments].sort((x,y)=>x.from.localeCompare(y.from))[i];
  const matching=rules.filter(r=>r.salesId===share.salesId&&r.from<=a.from&&
    (r.until===null||r.until>=a.until));
  if(matching.length!==1)throw new Error('ambiguous or missing commission rate');
  const rule=matching[0];
  if(rule.payoutPolicy!=='monthly')throw new Error('upfront commission requires separate audit');
  let earned;
  if(rule.mode==='percent'){
   const bp=hundredths(rule.amount,10000n);
   earned=round(share.amountSatang,bp,10000n);
  }else if(rule.mode==='fixed'){
   const fixed=hundredths(rule.amount,999_999_999_999n);
   earned=round(fixed,BigInt(share.days),overallDays);
  }else throw new Error('unsupported commission rule');
  total+=earned;
  return {salesId:share.salesId,serviceStart:a.from,serviceEnd:a.until,
    basisSatang:share.amountSatang.toString(),proposedSatang:earned.toString(),
    ruleId:rule.id,mode:rule.mode};
 });
 if(total>basis)throw new RangeError('commission exceeds net collected revenue');
 return {status:'preview_only',settled:false,payable:false,
  revenueExVatSatang:basis.toString(),totalProposedSatang:total.toString(),
  allocations:previews};
}
