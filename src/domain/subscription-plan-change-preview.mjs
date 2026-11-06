/**
 * Pure, read-only schedule PREVIEW for a future plan-change workflow.
 *
 * This does not persist subscriptions, accept payment, prorate charges,
 * activate a plan or mutate module permissions. A runtime integration MUST
 * perform authorized, idempotent SQL scheduling and actual billing separately.
 *
 * A chosen future start must coincide with an existing renewal boundary;
 * arbitrary dates cannot silently truncate a paid service period.
 * Current period boundaries are stored as UTC instants, whereas owner-facing
 * calendar dates are shown in Asia/Bangkok; never interpret the display date
 * as midnight UTC or Bangkok unless it is the actual period boundary.
 */
import {nextSubscriptionWindow} from './subscription-renewal.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const FREQ=new Set(['monthly','yearly']);
function dateOnly(value){
 if(typeof value!=='string'||!DATE.test(value))throw new RangeError('invalid requested start date');
 const d=new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)
  throw new RangeError('invalid requested start date');
 return value;
}
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
  throw new RangeError('invalid period-end instant');
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))throw new RangeError('invalid period-end instant');
 return d;
}
function bangkok(date){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23',
 }).formatToParts(date);
 const get=t=>parts.find(x=>x.type===t)?.value||'';
 return {date:get('year')+'-'+get('month')+'-'+get('day'),
  time:get('hour')+':'+get('minute')};
}
const move=(current,frequency,anchorDay)=>{
 const utc=current.toISOString();
 const w=nextSubscriptionWindow({previousEnd:utc.slice(0,10),
  billingFrequency:frequency,anchorDay});
 return new Date(w.serviceEnd+'T'+utc.slice(11));
};
/**
 * @returns proposed effective instant, previously paid entitlement end and
 * number of intervening old-plan renewal periods. Never writes a record.
 * No "now" mid-period switching because proration/credit policy isn't live.
 */
export function previewSubscriptionPlanChange({
 currentPlanId,nextPlanId,currentBillingFrequency,nextBillingFrequency,
 currentPeriodEndUtc,requestedStartOn=null,anchorDay,
 mode='next_renewal',nowUtc='2026-11-06T00:00:00.000Z',
}){
 if(!UUID.test(currentPlanId||'')||!UUID.test(nextPlanId||''))
  throw new TypeError('invalid plan ID');
 if(currentPlanId.toLowerCase()===nextPlanId.toLowerCase())
  throw new RangeError('same plan change is not permitted');
 if(!FREQ.has(currentBillingFrequency)||!FREQ.has(nextBillingFrequency))
  throw new RangeError('invalid billing frequency');
 if(!Number.isInteger(anchorDay)||anchorDay<1||anchorDay>31)
  throw new RangeError('invalid renewal anchor');
 if(!['next_renewal','future_renewal'].includes(mode))
  throw new RangeError('mid-period change requires explicit proration and consent');
 const now=instant(nowUtc),end=instant(currentPeriodEndUtc);
 if(end<=now)throw new RangeError('current subscription renewal boundary has passed');
 let next=end,continuationPeriods=0;
 if(requestedStartOn!==null){
  const requested=dateOnly(requestedStartOn);
  if(requested<bangkok(end).date)throw new RangeError('start cannot predate current period end');
  let found=false;
  for(let i=0;i<61;i++){
   if(bangkok(next).date===requested){found=true;break;}
   if(bangkok(next).date>requested)break;
   next=move(next,currentBillingFrequency,anchorDay);
   continuationPeriods++;
  }
  if(!found)throw new RangeError('start must coincide with a renewal boundary');
 }
 if(mode==='next_renewal'&&continuationPeriods!==0)
  throw new RangeError('next renewal must use current period end');
 if(mode==='future_renewal'&&requestedStartOn===null)
  throw new RangeError('future renewal requires an explicit date');
 const local=bangkok(next);
 return {
  currentPlanId,nextPlanId,mode,
  oldPlanUntilExclusiveUtc:next.toISOString(),
  newPlanEffectiveAtUtc:next.toISOString(),
  startDateBangkok:local.date,startTimeBangkok:local.time,
  oldPlanRenewalsBeforeSwitch:continuationPeriods,
  nextBillingFrequency,prorationIncluded:false,
  status:'PREVIEW_ONLY_NO_BILLING_OR_ENTITLEMENT_MUTATION'
 };
}
