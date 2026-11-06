/**
 * Pure state contract for a FUTURE authenticated, transactionally stored
 * station SaaS plan change. No storage, payment, invoice or entitlement I/O.
 *
 * The caller must authorize the owner and station, lock current subscription
 * and pending intent rows, store immutable price snapshot and deduplicate
 * idempotency keys in SQL. This module alone must NEVER activate a plan.
 */
import {previewSubscriptionPlanChange} from './subscription-plan-change-preview.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const clone=value=>structuredClone(value);
function validInstant(value){
 const match=typeof value==='string' &&
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
 if(!match)throw new RangeError('invalid transition timestamp');
 const calendar=new Date(match[1]+'T00:00:00Z');
 if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==match[1]||
  Number(match[2])>23||Number(match[3])>59||Number(match[4])>59||
  Number(match[7]||0)>14||Number(match[8]||0)>59||
  (Number(match[7]||0)===14&&Number(match[8]||0)!==0))
  throw new RangeError('invalid transition timestamp');
 const millis=Date.parse(value);
 if(!Number.isFinite(millis))throw new RangeError('invalid transition timestamp');
 return millis;
}
function assertKey(key){
 if(typeof key!=='string'||!KEY.test(key))throw new TypeError('invalid idempotency key');
}
function assertIdentity(actorId,stationId){
 if(!UUID.test(actorId||'')||!UUID.test(stationId||''))
  throw new TypeError('invalid actor or station ID');
}
function fingerprint(payload){
 // Canonical fixed-field payload, independent of object key order or clock.
 return JSON.stringify([
  payload.actorId,payload.stationId,payload.currentSubscriptionId,
  payload.currentPlanId,payload.nextPlanId,
  payload.currentBillingFrequency,payload.nextBillingFrequency,
  payload.currentPeriodEndUtc,payload.anchorDay,
  payload.mode,payload.requestedStartOn,
 ]);
}
/**
 * Caller must use one locked, authoritative subscription snapshot.
 * existingIntent is either absent or the single open intent for that station.
 */
export function proposeStationPlanChange({
 actorId,stationId,currentSubscriptionId,currentPlanId,nextPlanId,
 currentBillingFrequency,nextBillingFrequency,currentPeriodEndUtc,anchorDay,
 mode='next_renewal',requestedStartOn=null,nowUtc,idempotencyKey,
 existingIntent=null,
}){
 assertIdentity(actorId,stationId);
 if(!UUID.test(currentSubscriptionId||''))throw new TypeError('invalid subscription ID');
 assertKey(idempotencyKey);
 validInstant(nowUtc);
 const payload={actorId,stationId,currentSubscriptionId,currentPlanId,nextPlanId,
  currentBillingFrequency,nextBillingFrequency,currentPeriodEndUtc,
  anchorDay,mode,requestedStartOn};
 const signature=fingerprint(payload);
 if(existingIntent){
  if(existingIntent.stationId!==stationId)throw new RangeError('foreign station intent');
  if(existingIntent.idempotencyKey===idempotencyKey){
   if(existingIntent.fingerprint!==signature)
    throw new RangeError('idempotency payload mismatch');
   return {intent:clone(existingIntent),replayed:true};
  }
  if(existingIntent.status==='pending'||existingIntent.status==='ready')
   throw new RangeError('open transition already exists');
 }
 const preview=previewSubscriptionPlanChange({
  currentPlanId,nextPlanId,currentBillingFrequency,nextBillingFrequency,
  currentPeriodEndUtc,anchorDay,mode,requestedStartOn,nowUtc,
 });
 const intent={
  status:'pending',idempotencyKey,fingerprint:signature,actorId,stationId,
  currentSubscriptionId,currentPlanId,nextPlanId,
  requestedAtUtc:new Date(validInstant(nowUtc)).toISOString(),
  effectiveAtUtc:preview.newPlanEffectiveAtUtc,
  oldPlanUntilExclusiveUtc:preview.oldPlanUntilExclusiveUtc,
  nextBillingFrequency,oldPlanRenewalsBeforeSwitch:preview.oldPlanRenewalsBeforeSwitch,
  paymentState:'not_confirmed',cancelledAtUtc:null,
  policy:'NEXT_RENEWAL_NO_SILENT_PRORATION',
 };
 return {intent,replayed:false};
}
/** Cancels only a still-pending intent, before its effective boundary. */
export function cancelStationPlanChange({intent,stationId,nowUtc}){
 if(!intent||intent.stationId!==stationId)throw new RangeError('foreign station intent');
 const now=validInstant(nowUtc);
 if(intent.status==='cancelled')return clone(intent);
 if(intent.status!=='pending'||now>=validInstant(intent.effectiveAtUtc))
  throw new RangeError('transition cannot be cancelled at this state or time');
 return {...clone(intent),status:'cancelled',cancelledAtUtc:new Date(now).toISOString()};
}
/**
 * Returns readiness only; NEVER performs a charge, grants modules, writes
 * subscriptions or treats the callback as an authenticated payment webhook.
 */
export function inspectPlanChangeActivation({intent,nowUtc,paymentConfirmed=false}){
 if(!intent||!['pending','ready','cancelled','applied'].includes(intent.status))
  throw new TypeError('invalid transition intent');
 const now=validInstant(nowUtc),effective=validInstant(intent.effectiveAtUtc);
 if(intent.status==='cancelled')return {eligible:false,reason:'cancelled'};
 if(intent.status==='applied')return {eligible:false,reason:'already_applied'};
 if(now<effective)return {eligible:false,reason:'effective_time_not_reached'};
 if(paymentConfirmed!==true)return {eligible:false,reason:'payment_not_confirmed'};
 return {eligible:true,reason:'requires_atomic_authorized_db_activation',
  stationId:intent.stationId,currentSubscriptionId:intent.currentSubscriptionId,
  nextPlanId:intent.nextPlanId,effectiveAtUtc:intent.effectiveAtUtc};
}
