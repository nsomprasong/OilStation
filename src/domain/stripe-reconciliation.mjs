/** Extract only signed payment_intent.succeeded evidence.
 * Do not use caller-supplied metadata to locate a new payment attempt.
 * Metadata IDs and amount must match the pre-existing, Stripe-ID-bound DB record.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PI=/^pi_[A-Za-z0-9]{6,100}$/;
export function paidStripeEvidence(event){
 if(event?.type!=='payment_intent.succeeded'||event.livemode!==false)
  return null;
 const p=event?.data?.object;
 if(p?.object!=='payment_intent'||p.livemode!==false||
    !PI.test(p.id??'')||!UUID.test(p.metadata?.saas_invoice_id??'')||
    !UUID.test(p.metadata?.saas_payment_attempt_id??'')||
    p.currency!=='thb'||p.status!=='succeeded'||
    !Number.isSafeInteger(p.amount)||!Number.isSafeInteger(p.amount_received)||
    p.amount<1000||p.amount>99_999_999||p.amount_received!==p.amount)
  throw new TypeError('invalid_test_payment_evidence');
 return {eventId:event.id,paymentIntentId:p.id,
  invoiceId:p.metadata.saas_invoice_id,
  attemptId:p.metadata.saas_payment_attempt_id,
  amountSatang:p.amount,amountReceivedSatang:p.amount_received,
  currency:'thb',status:'succeeded',livemode:false};
}
