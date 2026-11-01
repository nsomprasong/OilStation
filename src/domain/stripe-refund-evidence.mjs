/** Strict evidence extracted ONLY after Stripe's raw-body signature is verified.
 * Refund objects do not inherit PaymentIntent metadata; the DB resolves the
 * pre-existing invoice/attempt from an immutable bound PaymentIntent.
 * This pure parser never creates a refund, wallet credit or invoice mutation.
 */
const PI=/^pi_[A-Za-z0-9]{6,100}$/;
const REFUND=/^re_[A-Za-z0-9]{6,100}$/;
const CHARGE=/^ch_[A-Za-z0-9]{6,100}$/;
export function succeededTestRefundEvidence(event){
 if(!['refund.created','refund.updated'].includes(event?.type)||
    event?.livemode!==false)return null;
 const refund=event?.data?.object;
 if(refund?.status!=='succeeded')return null; // Pending or failed is NOT money returned.
 if(refund.object!=='refund'||refund.livemode!==false||
    !REFUND.test(refund.id??'')||!PI.test(refund.payment_intent??'')||
    !CHARGE.test(refund.charge??'')||refund.currency!=='thb'||
    !Number.isSafeInteger(refund.amount)||refund.amount<1||
    refund.amount>99_999_999)
  throw new TypeError('invalid_test_refund_evidence');
 return {eventId:event.id,refundId:refund.id,
  paymentIntentId:refund.payment_intent,chargeId:refund.charge,
  amountSatang:refund.amount,currency:'thb',status:'succeeded',livemode:false};
}
