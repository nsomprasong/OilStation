/**
 * Payroll arithmetic only; statutory tax/social-security values are supplied
 * by a separately reviewed payroll rules engine (not guessed here).
 * OT enters gross pay ONLY after approval in the shift workflow.
 */
const fields=['baseSatang','approvedOtSatang','otherEarningsSatang',
  'taxSatang','socialSecuritySatang','advanceRepaymentSatang','otherDeductionsSatang','adjustmentSatang'];
function values(input){
  const out={};
  for(const k of fields){
    const value=input?.[k]??0n;
    if(typeof value!=='bigint') throw new TypeError(k+' must be bigint');
    if(value<0n&&k!=='adjustmentSatang') throw new RangeError(k+' cannot be negative');
    out[k]=value;
  }
  return out;
}
export function calculateNetPayroll(input){
  const p=values(input);
  const gross=p.baseSatang+p.approvedOtSatang+p.otherEarningsSatang+p.adjustmentSatang;
  const deductions=p.taxSatang+p.socialSecuritySatang+p.advanceRepaymentSatang+p.otherDeductionsSatang;
  if(gross<0n||deductions>gross) throw new RangeError('net salary cannot be negative');
  return {grossSatang:gross,deductionsSatang:deductions,netSatang:gross-deductions};
}
export function approvedAdvanceRepayment({outstandingSatang,plannedSatang,allowableDeductionSatang}){
  for(const value of [outstandingSatang,plannedSatang,allowableDeductionSatang]){
    if(typeof value!=='bigint'||value<0n) throw new RangeError('invalid repayment amount');
  }
  return [outstandingSatang,plannedSatang,allowableDeductionSatang].reduce((a,b)=>a<b?a:b);
}
