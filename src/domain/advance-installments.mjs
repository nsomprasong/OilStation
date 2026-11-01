/** Nonpayable, integer-satang planned installments; actual payroll deductions need separate authorization. */
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new RangeError('invalid start date');
 const d=new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new RangeError('invalid start date');
 return d;
}
function iso(d){return d.toISOString().slice(0,10);}
export function planAdvanceInstallments({principalSatang,installments,firstDeductionDate,frequency}){
 if(!Number.isSafeInteger(principalSatang)||principalSatang<1||principalSatang>999_999_999_999)
  throw new RangeError('invalid advance amount');
 if(!Number.isInteger(installments)||installments<1||installments>24)
  throw new RangeError('installment count must be 1-24');
 if(!['weekly','semi_monthly','monthly'].includes(frequency))
  throw new RangeError('invalid payroll frequency');
 const first=validDate(firstDeductionDate),day=first.getUTCDate();
 const firstMonth=first.getUTCFullYear()*12+first.getUTCMonth();
 function dateAt(i){
  if(frequency==='weekly'){const d=new Date(first);d.setUTCDate(d.getUTCDate()+7*i);return iso(d);}
  if(frequency==='semi_monthly'){
   if(day!==15&&day!==new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate())
    throw new RangeError('semi-monthly starts only on 15th or month end');
   // Alternate 15th and last day; preserve selected start and do not drift.
   const firstIsMid=day===15;
   const m=firstMonth+Math.floor((i+(firstIsMid?0:1))/2);
   const y=Math.floor(m/12),mo=m%12;
   const mid=(i%2===0)===firstIsMid;
   return iso(new Date(Date.UTC(y,mo,mid?15:new Date(Date.UTC(y,mo+1,0)).getUTCDate())));
  }
  const m=firstMonth+i,y=Math.floor(m/12),mo=m%12;
  const cap=new Date(Date.UTC(y,mo+1,0)).getUTCDate();
  return iso(new Date(Date.UTC(y,mo,Math.min(day,cap))));
 }
 const per=Math.floor(principalSatang/installments);
 return Array.from({length:installments},(_,i)=>({
  installment:i+1,date:dateAt(i),
  amountSatang:i===installments-1?principalSatang-per*(installments-1):per,
  status:'planned_only',
 }));
}
