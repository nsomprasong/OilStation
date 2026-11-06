/** Pure event preflight. Payment authenticity still requires verified provider signature. */
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const LEDGER_KEY=/^(?:stripe_test|stripe_live|bank_review):[A-Za-z0-9_-]{8,128}$/;
export function inspectSaasWebhookReplay({provider,eventId,knownEventIds,signatureVerified}){
 if(!['stripe_test','stripe_live','bank_review'].includes(provider))
  throw new TypeError('invalid provider');
 if(typeof eventId!=='string'||!ID.test(eventId))throw new TypeError('invalid event ID');
 if(!Array.isArray(knownEventIds)||knownEventIds.length>10000||
    knownEventIds.some(x=>typeof x!=='string'||!LEDGER_KEY.test(x)))
  throw new TypeError('invalid ledger history');
 if(signatureVerified!==true)return Object.freeze({process:false,reason:'provider_not_verified'});
 if(knownEventIds.includes(provider+':'+eventId))
  return Object.freeze({process:false,reason:'duplicate_provider_event'});
 return Object.freeze({process:false,reason:'requires_atomic_unique_ledger_insert',
  ledgerKey:provider+':'+eventId});
}
