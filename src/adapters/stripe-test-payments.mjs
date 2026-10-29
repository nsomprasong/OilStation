/** Stripe test-only PaymentIntent adapter.
 * Always use persisted, invoice-scoped idempotency keys and Stripe secret on Worker.
 */
const PI=/^pi_[A-Za-z0-9]{6,100}$/;
const SECRET=/^sk_test_[A-Za-z0-9_]{12,}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createStripeTestPaymentIntents(secret,{fetchImpl=fetch}={}){
 if(typeof secret!=='string'||!SECRET.test(secret))throw new Error('test_mode_stripe_required');
 const send=async(path,init={})=>{
  const res=await fetchImpl('https://api.stripe.com/v1/'+path,{...init,headers:{
   authorization:'Bearer '+secret,...(init.headers||{}),
  },signal:AbortSignal.timeout(12_000)});
  if(!res.ok)throw new Error('stripe_provider_failed');
  const json=await res.json();
  if(!PI.test(json?.id??'')||json.livemode!==false||
      typeof json.client_secret!=='string'||!json.client_secret.startsWith(json.id+'_secret_'))
   throw new Error('invalid_stripe_payment_intent');
  return json;
 };
 return {
  async create({invoiceId,attemptId,amountSatang,paymentMethod,idempotencyKey}){
   if(!UUID.test(invoiceId)||!UUID.test(attemptId)||
      !Number.isSafeInteger(amountSatang)||amountSatang<1000||amountSatang>99_999_999||
      !['card','promptpay'].includes(paymentMethod)||
      typeof idempotencyKey!=='string'||!/^oilstation-pi-[0-9a-f-]{36}$/.test(idempotencyKey))
    throw new TypeError('invalid_invoice_payment');
   const body=new URLSearchParams({
    amount:String(amountSatang),currency:'thb',
    'payment_method_types[]':paymentMethod,
    'metadata[saas_invoice_id]':invoiceId,
    'metadata[saas_payment_attempt_id]':attemptId,
    description:'OilStation SaaS subscription',
   });
   const result=await send('payment_intents',{method:'POST',headers:{
    'content-type':'application/x-www-form-urlencoded',
    'idempotency-key':idempotencyKey,
   },body});
   if(result.amount!==amountSatang||result.currency!=='thb'||
     result.metadata?.saas_invoice_id!==invoiceId||
     result.metadata?.saas_payment_attempt_id!==attemptId)
    throw new Error('stripe_payment_mismatch');
   return {id:result.id,clientSecret:result.client_secret,status:result.status};
  },
  async retrieve({paymentIntentId,invoiceId,attemptId,amountSatang}){
   if(!PI.test(paymentIntentId)||!UUID.test(invoiceId)||!UUID.test(attemptId)||
      !Number.isSafeInteger(amountSatang))throw new TypeError('invalid_payment_retrieval');
   const result=await send('payment_intents/'+encodeURIComponent(paymentIntentId));
   if(result.amount!==amountSatang||result.currency!=='thb'||
     result.metadata?.saas_invoice_id!==invoiceId||
     result.metadata?.saas_payment_attempt_id!==attemptId)
     throw new Error('stripe_payment_mismatch');
   return {id:result.id,clientSecret:result.client_secret,status:result.status};
  },
 };
}
