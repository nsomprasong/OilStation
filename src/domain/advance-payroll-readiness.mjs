/**
 * Salary advance deductions are only proposed for payroll review.
 * No payment, booking, wage deduction, bank transfer or ledger mutation.
 * Dates are local calendar dates, with the payroll period's end exclusive.
 */
import {planAdvanceInstallments} from './advance-installments.mjs';

const day = value => {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  throw new RangeError('invalid payroll date');
 const d=new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw new RangeError('invalid payroll date');
 return d;
};
const integer = (value,name) => {
 const n=typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)?
  Number(value):value;
 if(!Number.isSafeInteger(n)||n<0)throw new RangeError('invalid '+name);
 return n;
};
export function reviewAdvanceDeductions(advance,{startDate,endDate}={}){
 if(!advance||typeof advance!=='object')throw new TypeError('advance required');
 const start=day(startDate),end=day(endDate);
 if(end<=start||end-start>366*86400000)throw new RangeError('invalid period');
 const principal=integer(advance.amountSatang,'principal');
 const outstanding=integer(advance.outstandingSatang,'outstanding');
 if(principal<1||outstanding>principal)throw new RangeError('invalid advance balance');
 const allowedStatuses=new Set(['requested','approved','rejected','paid','repaid']);
 if(!allowedStatuses.has(advance.status))throw new RangeError('invalid advance status');
 const count=integer(advance.installments,'installments');
 if(count<1||count>24||count>principal)throw new RangeError('invalid installment count');
 const plan=planAdvanceInstallments({principalSatang:principal,installments:count,
  firstDeductionDate:advance.firstDeductionDate,frequency:advance.frequency});
 let priorPaid=principal-outstanding;
 const schedule=plan.map(row=>{
  const settled=Math.min(row.amountSatang,priorPaid);
  priorPaid-=settled;
  const remaining=row.amountSatang-settled;
  const inPeriod=row.date>=startDate&&row.date<endDate;
  return {...row,settledSatang:settled,remainingSatang:remaining,inPeriod,
   deductionAllowed:false,
   reviewState:remaining===0?'already_repaid':
    advance.status==='requested'?'awaiting_approval':
    advance.status==='approved'?'awaiting_disbursement_verification':
    advance.status==='rejected'?'rejected':
    advance.status==='repaid'?'reconciliation_needed':
    'awaiting_payroll_and_legal_review'};
 });
 const due=schedule.filter(x=>x.inPeriod&&x.remainingSatang>0);
 const plannedInPeriodSatang=due.reduce((total,x)=>total+x.remainingSatang,0);
 // A confirmed external bank receipt, an independently approved payroll run and
 // deduction caps must be attested by a separate system before posting.
 const blockers=advance.status==='paid'?['bank_evidence_and_payroll_approval_required']:
  advance.status==='approved'?['advance_not_disbursed']:
  advance.status==='requested'?['advance_approval_pending']:
  advance.status==='rejected'?['advance_rejected']:
  advance.status==='repaid'?[]:['unknown_advance_state'];
 if(advance.status==='repaid'&&outstanding!==0)blockers.push('invalid_repaid_balance');
 if(advance.status==='paid'&&outstanding===0)blockers.push('settlement_not_reconciled');
 return {advanceId:advance.id??null,status:advance.status,frequency:advance.frequency,
  firstDeductionDate:advance.firstDeductionDate,installments:count,
  principalSatang:principal,outstandingSatang:outstanding,
  plannedInPeriodSatang,deductibleSatang:0,postedSatang:0,
  payable:false,blocked:advance.status!=='repaid'||blockers.length>0,
  blockers,period:{startDate,endDate},schedule};
}
