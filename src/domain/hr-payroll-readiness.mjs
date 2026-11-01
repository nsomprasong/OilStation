/**
 * Fail-closed readiness only: never approves, locks, posts, pays, taxes or
 * deducts wages. Everything here is evidence from an employee-scoped DB RPC.
 */
const count=(v,name)=>{
 if(!Number.isSafeInteger(v)||v<0||v>100000)
  throw new RangeError('invalid '+name);
 return v;
};
const unique=v=>[...new Set(v)];
export function assessPayrollReadiness(evidence){
 if(!evidence||typeof evidence!=='object'||evidence.readOnly!==true||
    evidence.payable!==false||evidence.postedSatang!==0)
  throw new TypeError('unsafe payroll evidence');
 const fields=['pendingLeave','approvedLeave','approvedUnpaidLeave','pendingOt',
  'approvedOt','scheduledShifts','attendancePunches','unreviewedPunches',
  'rejectedPunches','approvedPrimaryPayees','openAdvances'];
 const n=Object.fromEntries(fields.map(f=>[f,count(evidence[f],f)]));
 if(n.unreviewedPunches>n.attendancePunches ||
    n.rejectedPunches>n.unreviewedPunches ||
    n.approvedUnpaidLeave>n.approvedLeave)
  throw new RangeError('inconsistent payroll counters');
 if(!/^(0|[1-9]\d*)$/.test(evidence.wageSatang||''))
  throw new TypeError('invalid wage satang');
 const wage=BigInt(evidence.wageSatang);
 const blockers=[];
 if(evidence.employeeStatus!=='active')blockers.push('employee_not_active');
 if(!['monthly','daily','hourly'].includes(evidence.wageType)||wage===0n)
  blockers.push('wage_not_configured');
 if(!['monthly','weekly','semi_monthly'].includes(evidence.payrollFrequency))
  blockers.push('frequency_not_configured');
 if(n.pendingLeave>0)blockers.push('pending_leave');
 if(n.approvedLeave>0)blockers.push('leave_pay_policy_unverified');
 if(n.pendingOt>0)blockers.push('pending_overtime');
 if(n.approvedOt>0)blockers.push('overtime_rate_unverified');
 if(n.unreviewedPunches>0)blockers.push('unreviewed_attendance');
 if(n.rejectedPunches>0)blockers.push('rejected_attendance');
 if(n.scheduledShifts>0&&n.attendancePunches===0)
  blockers.push('missing_attendance');
 if(n.approvedPrimaryPayees!==1)blockers.push('approved_primary_payee_required');
 if(n.openAdvances>0)blockers.push('advance_reconciliation_required');
 if(evidence.policyReviewed!==true)blockers.push('wage_and_leave_policy_unreviewed');
 if(evidence.statutoryReviewed!==true)blockers.push('tax_social_security_unreviewed');
 const issueCodes=unique(blockers);
 return {
  employeeId:evidence.employeeId,stationId:evidence.stationId,
  startDate:evidence.startDate,endDate:evidence.endDate,
  status:'blocked_pending_review',readOnly:true,payable:false,
  postedSatang:0,deductibleSatang:0,bankTransferAuthorized:false,
  salaryCanBeApproved:false,issueCodes,
  evidenceCounts:n,
  // PII and wage information are omitted: this endpoint is an audit checklist,
  // not a pay statement or a wage-rate disclosure.
 };
}