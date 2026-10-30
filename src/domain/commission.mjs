/**
 * Deterministic monthly Sales allocation.
 * Dates are ISO YYYY-MM-DD, [start,end) day boundaries. A transferred station
 * is paid to the Sales assigned for each service day, not its original seller.
 * Caller must first verify that the SaaS invoice was collected successfully.
 */
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function day(s){
  if(typeof s!=='string'||!DATE.test(s)) throw new TypeError('date must be YYYY-MM-DD');
  const date=new Date(s+'T00:00:00.000Z');
  if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==s) throw new RangeError('invalid date');
  return Math.floor(date.getTime()/86_400_000);
}
function amount(x){
  if(typeof x!=='bigint'||x<0n) throw new RangeError('amount must be nonnegative bigint satang');
  return x;
}
export function allocateCommission({ paid, monthlyAmountSatang, startDate, endDate, assignments }) {
  const total=amount(monthlyAmountSatang);
  const start=day(startDate), end=day(endDate);
  if(end<=start) throw new RangeError('invalid service period');
  if(!Array.isArray(assignments)||!assignments.length) throw new RangeError('assignments required');
  if(!paid) return [];
  let cursor=start;
  const spans=[];
  for(const a of [...assignments].sort((a,b)=>a.from.localeCompare(b.from))){
    const from=day(a.from), until=day(a.until);
    if(!a.salesId||from!==cursor||until<=from||until>end) throw new RangeError('sales assignment gap or overlap');
    spans.push({salesId:a.salesId,days:BigInt(until-from)});
    cursor=until;
  }
  if(cursor!==end) throw new RangeError('sales assignment does not cover service period');
  const totalDays=BigInt(end-start);
  let allocated=0n;
  return spans.map((span,index)=>{
    const amountSatang=index===spans.length-1?total-allocated:(total*span.days)/totalDays;
    allocated+=amountSatang;
    return {salesId:span.salesId,days:Number(span.days),amountSatang};
  });
}
export function adjustPaidCommission({previouslyPaidSatang,revisedEntitlementSatang}){
  if(typeof previouslyPaidSatang!=='bigint'||typeof revisedEntitlementSatang!=='bigint') throw new TypeError('amount must be bigint');
  if(previouslyPaidSatang<0n||revisedEntitlementSatang<0n) throw new RangeError('amount cannot be negative');
  return revisedEntitlementSatang-previouslyPaidSatang; // negative = recover from future commissions, never salary
}
