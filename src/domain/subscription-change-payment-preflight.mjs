/** Readiness hint only. A bool/event is never proof of Stripe or bank settlement. */
const KEY=/^[A-Za-z0-9_-]{8,128}$/;
export function inspectSaasPaymentPreflight({paymentMethod,providerEventId,
  verifiedServerSide=false,amountDueSatang,amountReceivedSatang}){
 if(!['card','promptpay'].includes(paymentMethod))throw new TypeError('unsupported payment method');
 if(typeof amountDueSatang!=='string'||!/^(0|[1-9]\d{0,11})$/.test(amountDueSatang))
  throw new RangeError('invalid due amount');
 if(typeof amountReceivedSatang!=='string'||!/^(0|[1-9]\d{0,11})$/.test(amountReceivedSatang))
  throw new RangeError('invalid received amount');
 if(verifiedServerSide!==true)return Object.freeze({ready:false,reason:'requires_trusted_server_verification'});
 if(typeof providerEventId!=='string'||!KEY.test(providerEventId))
  return Object.freeze({ready:false,reason:'missing_provider_event'});
 if(BigInt(amountReceivedSatang)<BigInt(amountDueSatang))
  return Object.freeze({ready:false,reason:'underpaid'});
 return Object.freeze({ready:true,reason:'requires_ledger_and_webhook_idempotency_reconciliation',
  providerEventId,paymentMethod});
}
