/** Pure rescheduling guard. Must cancel and issue new DB request atomically elsewhere. */
export function previewSaasSwitchReschedule({existingIntent,nowUtc,newIdempotencyKey}){
 if(!existingIntent||typeof existingIntent!=='object')throw new TypeError('missing prior intent');
 const key=/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
 if(typeof newIdempotencyKey!=='string'||!key.test(newIdempotencyKey)||
    newIdempotencyKey===existingIntent.idempotencyKey)
  throw new RangeError('fresh idempotency key required');
 if(typeof nowUtc!=='string'||!Number.isFinite(Date.parse(nowUtc)))
  throw new TypeError('invalid time');
 if(typeof existingIntent.effectiveAtUtc!=='string'||
    !Number.isFinite(Date.parse(existingIntent.effectiveAtUtc)))
  throw new TypeError('invalid old effective time');
 if(existingIntent.status!=='pending'||Date.parse(nowUtc)>=Date.parse(existingIntent.effectiveAtUtc))
  return Object.freeze({allowed:false,reason:'old_intent_not_cancellable'});
 return Object.freeze({allowed:true,reason:'requires_atomic_cancel_and_new_request',
  originalRequestKey:existingIntent.idempotencyKey,newIdempotencyKey,
  mustPreserveOldAudit:true});
}
