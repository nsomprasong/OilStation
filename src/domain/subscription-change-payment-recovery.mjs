/** Pure retry decision; cannot retry Stripe or post an invoice. */
export function previewSaasPaymentRecovery({status,attempts,lastAttemptUtc,nowUtc}){
 if(!['pending','failed','paid','cancelled'].includes(status))throw new TypeError('invalid payment status');
 if(!Number.isInteger(attempts)||attempts<0||attempts>100)throw new RangeError('invalid attempts');
 const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
 if(typeof nowUtc!=='string'||!iso.test(nowUtc)||!Number.isFinite(Date.parse(nowUtc)))throw new TypeError('invalid now');
 const now=Date.parse(nowUtc);
 if(status==='paid'||status==='cancelled')return Object.freeze({retry:false,reason:'terminal_payment_state'});
 if(status==='pending')return Object.freeze({retry:false,reason:'payment_still_pending'});
 if(attempts===0||attempts>=3)return Object.freeze({retry:false,reason:'retry_limit_or_no_prior_attempt'});
 if(typeof lastAttemptUtc!=='string'||!iso.test(lastAttemptUtc)||!Number.isFinite(Date.parse(lastAttemptUtc)))throw new TypeError('invalid last attempt');
 const earlier=Date.parse(lastAttemptUtc);
 if(earlier>now)return Object.freeze({retry:false,reason:'future_attempt_timestamp'});
 const delayMinutes=attempts===1?15:60;
 const retryAt=new Date(earlier+delayMinutes*60_000).toISOString();
 return Object.freeze({retry:now>=Date.parse(retryAt),reason:now>=Date.parse(retryAt)?'manual_reconciliation_required':'cooldown',retryAtUtc:retryAt});
}
