/** Secure embedded payment start: pricing comes from immutable issued invoice. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createBillingPaymentApi({authenticate,db,payments,enabled=false}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/billing/payment-intent')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(!enabled||!payments)return json(503,{error:'test_billing_disabled'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!match)return json(401,{error:'unauthenticated'});
  if(Number(request.headers.get('content-length'))>1024)return json(413,{error:'body_too_large'});
  const raw=await request.text();
  if(raw.length>1024)return json(413,{error:'body_too_large'});
  let data;try{data=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
  if(!data||Array.isArray(data)||Object.keys(data).length!==2||
   !UUID.test(data.invoiceId??'')||!['card','promptpay'].includes(data.paymentMethod))
   return json(400,{error:'invalid_invoice_payment'});
  try{
   const user=await authenticate(match[1]);
   if(!user?.id||!UUID.test(user.id))return json(401,{error:'unauthenticated'});
   const prepared=await db.prepareSaasPayment({
     actorId:user.id,invoiceId:data.invoiceId,paymentMethod:data.paymentMethod,
   });
   const amount=Number(prepared.amountSatang);
   const trusted={invoiceId:data.invoiceId,amountSatang:amount};
   if(!Number.isSafeInteger(amount)||amount<1000||amount>99_999_999)
    throw new Error('unusable_invoice');
   // No amount from client. On retry the persisted Stripe ID is retrieved,
   // not recreated after the provider's idempotency cache expiry.
   const intent=prepared.paymentIntentId?
    await payments.retrieve({...trusted,attemptId:prepared.attemptId,
      paymentIntentId:prepared.paymentIntentId}):
    await payments.create({...trusted,attemptId:prepared.attemptId,
     idempotencyKey:prepared.idempotencyKey,paymentMethod:data.paymentMethod});
   const result=await db.attachSaasPaymentIntent({
    actorId:user.id,attemptId:prepared.attemptId,paymentIntentId:intent.id,
   });
   if(result.paymentIntentId!==intent.id)throw new Error('payment_reference_conflict');
   return json(200,{clientSecret:intent.clientSecret,invoiceId:data.invoiceId,
      paymentMethod:data.paymentMethod,status:intent.status});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST'||e?.code==='PAYMENT_ALREADY_EXISTS')
    return json(409,{error:'invoice_unavailable'});
   return json(503,{error:'payment_provider_unavailable'});
  }
 };
}
