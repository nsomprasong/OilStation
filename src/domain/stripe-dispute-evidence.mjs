/** Signed Stripe TEST Dispute evidence for review history, not a financial posting.
 * A nullable payment_intent is deliberately rejected: never guess ownership
 * from charge metadata or user-controlled invoice identifiers.
 * Stripe may deliver lifecycle events out of order. Keep original event time.
 */
const TYPES=new Set(['charge.dispute.created','charge.dispute.updated','charge.dispute.closed']);
const STATES=new Set(['warning_needs_response','warning_under_review','warning_closed',
 'needs_response','under_review','won','lost','prevented']);
const PI=/^pi_[A-Za-z0-9]{6,100}$/;
const CHARGE=/^ch_[A-Za-z0-9]{6,100}$/;
const DISPUTE=/^du_[A-Za-z0-9]{6,100}$/;
const EVENT=/^evt_[A-Za-z0-9]{6,100}$/;
export function testDisputeReviewEvidence(event){
 if(!TYPES.has(event?.type)||event?.livemode!==false)return null;
 const d=event?.data?.object;
 if(!EVENT.test(event?.id??'')||!Number.isSafeInteger(event?.created)||
   event.created<1||event.created>9999999999||d?.object!=='dispute'||
   d.livemode!==false||!DISPUTE.test(d.id??'')||
   !PI.test(d.payment_intent??'')||!CHARGE.test(d.charge??'')||
   d.currency!=='thb'||!Number.isSafeInteger(d.amount)||
   d.amount<1||d.amount>99999999||!STATES.has(d.status)||
   (event.type==='charge.dispute.closed'&&
    !['won','lost','warning_closed','prevented'].includes(d.status)))
   throw new TypeError('invalid_test_dispute_evidence');
 return {eventId:event.id,eventType:event.type,eventCreated:event.created,
   disputeId:d.id,paymentIntentId:d.payment_intent,chargeId:d.charge,
   amountSatang:d.amount,currency:d.currency,status:d.status,livemode:false};
}
