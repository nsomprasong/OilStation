/**
 * Review-only scenario model, not the statutory payroll rules engine.
 * All amounts are integer satang. No tax/SSO/OT multiplier is guessed.
 * This function cannot approve, export, reconcile or pay a salary.
 */
import {calculateNetPayroll,approvedAdvanceRepayment} from './payroll.mjs';

const STATUSES=new Set(['worked','substitute','paid_leave','unpaid_leave','absent','off','pending']);
const OT_APPROVED=new Set(['approved','partial']);
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const satang=(v,name)=>{
 if(typeof v!=='bigint'||v<0n)throw new TypeError(name+' must be nonnegative bigint');
 return v;
};
const int=(v,name,lo=0,hi=100000)=>{
 if(!Number.isSafeInteger(v)||v<lo||v>hi)throw new RangeError(name+' invalid');
 return v;
};
const rounded=(numerator,denominator)=>(numerator+denominator/2n)/denominator;
const unique=list=>[...new Set(list)];

export function buildPayrollReview({
 wage,days=[],overtime=[],advances=[],
 statutory=null,policy={},adjustmentSatang=0n,
}={}){
 if(!wage||!['monthly','daily','hourly'].includes(wage.type))
  throw new RangeError('invalid wage type');
 const rate=satang(wage.rateSatang,'wage.rateSatang');
 if(!Array.isArray(days)||!Array.isArray(overtime)||!Array.isArray(advances))
  throw new TypeError('invalid payroll inputs');
 if(typeof adjustmentSatang!=='bigint')throw new TypeError('adjustmentSatang must be bigint');
 const issues=[],warnings=[];
 const seenShifts=new Set(),byDate=new Map(),ranges=new Map();
 let workMinutes=0,paidLeaveMinutes=0;
 for(const [index,d] of days.entries()){
  if(!d||typeof d.date!=='string'||!DAY.test(d.date)||
     Number.isNaN(Date.parse(d.date+'T00:00:00Z'))||
     new Date(d.date+'T00:00:00Z').toISOString().slice(0,10)!==d.date)
   throw new RangeError('invalid day date');
  if(!STATUSES.has(d.status))throw new RangeError('invalid day status');
  if(!d.shiftId||typeof d.shiftId!=='string')throw new RangeError('shiftId required');
  if(seenShifts.has(d.shiftId))issues.push('duplicate_shift');
  seenShifts.add(d.shiftId);
  if(!d.reviewed||d.status==='pending')issues.push('unreviewed_attendance_or_leave');
  const min=int(d.workedMinutes??0,'workedMinutes',0,2880);
  if(['worked','substitute'].includes(d.status))workMinutes+=min;
  else if(d.status==='paid_leave')paidLeaveMinutes+=int(d.paidMinutes??0,'paidMinutes',0,1440);
  else if(min>0)issues.push('nonworking_day_has_work');
  if(!byDate.has(d.date))byDate.set(d.date,new Set());
  byDate.get(d.date).add(d.status);
  if(['worked','substitute'].includes(d.status)){
   if(d.startMinute!==undefined||d.endMinute!==undefined){
    const start=int(d.startMinute,'startMinute',0,2879);
    const end=int(d.endMinute,'endMinute',1,2880);
    if(end<=start||min>end-start)issues.push('invalid_work_interval');
    if(!ranges.has(d.date))ranges.set(d.date,[]);
    ranges.get(d.date).push([start,end,index]);
   }else if(days.filter(x=>x.date===d.date&&['worked','substitute'].includes(x.status)).length>1)
    issues.push('missing_dual_shift_time_bounds');
  }
 }
 for(const statuses of byDate.values()){
  const exclusive=['paid_leave','unpaid_leave','absent','off'];
  if(exclusive.some(x=>statuses.has(x)) && statuses.size>1)issues.push('contradictory_daily_status');
 }
 for(const list of ranges.values()){
  list.sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<list.length;i++)if(list[i][0]<list[i-1][1])issues.push('overlapping_shifts');
 }
 if(!statutory||statutory.reviewed!==true)issues.push('statutory_rules_unreviewed');
 const tax=statutory?satang(statutory.taxSatang,'taxSatang'):0n;
 const social=statutory?satang(statutory.socialSecuritySatang,'socialSecuritySatang'):0n;
 const otherDeductions=satang(statutory?.otherDeductionsSatang??0n,'otherDeductionsSatang');
 const otherEarnings=satang(statutory?.otherEarningsSatang??0n,'otherEarningsSatang');
 let base;
 if(wage.type==='monthly'){
  const divisor=int(policy.monthlyDivisorDays,'monthlyDivisorDays',1,31);
  const deductedDays=[...byDate.values()].filter(s=>s.has('unpaid_leave')||s.has('absent')).length;
  if(deductedDays>divisor)issues.push('monthly_deduction_exceeds_divisor');
  base=rate-rounded(rate*BigInt(deductedDays),BigInt(divisor));
 }else if(wage.type==='daily'){
  const payableDays=[...byDate.values()].filter(s=>
   s.has('worked')||s.has('substitute')||s.has('paid_leave')).length;
  base=rate*BigInt(payableDays);
 }else{
  base=rounded(rate*BigInt(workMinutes+paidLeaveMinutes),60n);
 }
 if(base<0n)issues.push('negative_base_pay');
 let approvedOtSatang=0n;
 const seenOt=new Set();
 for(const row of overtime){
  if(!row||typeof row.id!=='string'||!row.id)throw new TypeError('OT id required');
  if(seenOt.has(row.id))issues.push('duplicate_ot');
  seenOt.add(row.id);
  int(row.requestedMinutes,'requestedMinutes',1,960);
  if(OT_APPROVED.has(row.status)){
   const minutes=int(row.approvedMinutes,'approvedMinutes',0,960);
   if(minutes>row.requestedMinutes||row.reviewed!==true)issues.push('ot_approval_invalid');
   approvedOtSatang+=satang(row.approvedPaySatang,'approvedPaySatang');
  }else if(row.status==='pending')warnings.push('pending_ot_excluded');
  else if(row.status!=='rejected')throw new RangeError('invalid OT status');
 }
 let advanceRepaymentSatang=0n;
 const seenAdvances=new Set();
 for(const a of advances){
  if(!a||typeof a.id!=='string'||!a.id)throw new TypeError('advance id required');
  if(seenAdvances.has(a.id))issues.push('duplicate_advance');
  seenAdvances.add(a.id);
  if(!['requested','approved','rejected','paid','repaid'].includes(a.status))
   throw new RangeError('invalid advance status');
  if(a.status==='paid'){
   if(a.deductionAuthorized!==true)issues.push('advance_deduction_unapproved');
   advanceRepaymentSatang+=approvedAdvanceRepayment({
    outstandingSatang:satang(a.outstandingSatang,'outstandingSatang'),
    plannedSatang:satang(a.plannedSatang,'plannedSatang'),
    allowableDeductionSatang:satang(a.allowableDeductionSatang,'allowableDeductionSatang'),
   });
  }
 }
 const issueCodes=unique(issues);
 if(issueCodes.length)return {
  status:'blocked',payable:false,issueCodes,warnings:unique(warnings),
  summary:null,
 };
 try{
  const summary=calculateNetPayroll({
   baseSatang:base,approvedOtSatang,otherEarningsSatang:otherEarnings,
   taxSatang:tax,socialSecuritySatang:social,advanceRepaymentSatang,
   otherDeductionsSatang:otherDeductions,adjustmentSatang,
  });
  return {status:'ready_for_review',payable:false,issueCodes:[],warnings:unique(warnings),
   summary:{...summary,baseSatang:base,approvedOtSatang,advanceRepaymentSatang,
    workedMinutes:workMinutes,paidLeaveMinutes}};
 }catch{
  return {status:'blocked',payable:false,issueCodes:['deductions_or_adjustments_exceed_pay'],
   warnings:unique(warnings),summary:null};
 }
}
