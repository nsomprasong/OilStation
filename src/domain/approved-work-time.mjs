/**
 * Converts reviewed time punches into exact worked minutes. Never treats GPS
 * 'inside' or unreviewed face evidence as payroll approval.
 * This is a pure draft preview, not a payroll-run closure or bank payout.
 */
const TYPES=['clock_in','clock_out','break_start','break_end'];
function timestamp(value){
 if(typeof value!=='string'||!/[zZ]|[+-]\d\d:\d\d$/.test(value))throw new TypeError('timestamp requires offset');
 const ms=Date.parse(value);
 if(!Number.isFinite(ms)||ms%60000!==0)throw new RangeError('timestamps must be minute-aligned');
 return ms;
}
export function reviewedWorkMinutes(events){
 if(!Array.isArray(events))throw new TypeError('punches must be an array');
 if(events.length>2000)throw new RangeError('too many punches');
 const seen=new Set();
 const series=events.map(e=>{
  if(!e||!TYPES.includes(e.eventType)||e.reviewStatus!=='accepted')
   throw new Error('only approved punches may be used for payroll');
  if(typeof e.id!=='string'||!e.id||seen.has(e.id))throw new Error('duplicate or missing punch id');
  seen.add(e.id);
  return {kind:e.eventType,when:timestamp(e.occurredAt)};
 }).sort((a,b)=>a.when-b.when);
 let active=false,rest=false,start=0,restStart=0,minutes=0,breakMinutes=0,shifts=0;
 let last=-Infinity;
 for(const e of series){
  if(e.when<=last)throw new Error('simultaneous or replayed timestamps');
  last=e.when;
  if(e.kind==='clock_in'){
   if(active||rest)throw new Error('overlapping shifts');
   active=true;start=e.when;shifts++;
  }else if(e.kind==='clock_out'){
   if(!active||rest)throw new Error('unclosed shift or break');
   const elapsed=(e.when-start)/60000;
   if(elapsed>24*60)throw new RangeError('shift over 24 hours requires review');
   minutes+=elapsed;active=false;
  }else if(e.kind==='break_start'){
   if(!active||rest)throw new Error('invalid break start');
   rest=true;restStart=e.when;
  }else{
   if(!active||!rest)throw new Error('invalid break end');
   const elapsed=(e.when-restStart)/60000;
   breakMinutes+=elapsed;minutes-=elapsed;
   rest=false;
  }
 }
 if(active||rest)throw new Error('unclosed shift');
 if(minutes<0)throw new Error('invalid work minutes');
 return {workedMinutes:minutes,breakMinutes,shifts};
}
