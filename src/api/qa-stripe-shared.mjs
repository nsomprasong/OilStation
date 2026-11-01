import {createBillingPaymentApi} from './billing-payment.mjs';
import {createStripeWebhookApi} from './stripe-webhook.mjs';
import {paidStripeEvidence} from '../domain/stripe-reconciliation.mjs';
import {createStripeTestPaymentIntents} from '../adapters/stripe-test-payments.mjs';
import {sharedProjectQaReconciliationEligible} from '../domain/stripe-test-environment.mjs';

// ONLY two explicitly routed operations bypass the broad API release marker.
// They use a fixed QA station and a separately attested, immutable QA invoice.
// A valid Stripe signature does not authorize a production customer invoice.
export function createSharedQaStripeApi({env,authenticate,db,payments}){
 const stationId=env.OILSTATION_QA_STRIPE_STATION_ID;
 const qaRunId=env.OILSTATION_QA_RUN_ID;
 const invoiceAuthorized=async(invoiceId,actorId=null)=>
   (await db.qaSaasInvoiceScope({invoiceId,actorId,stationId,qaRunId}))===true;
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/billing/payment-intent'){
   let prepared;
   const guardedDb={
    prepareSaasPayment:async d=>{
     if(!(await invoiceAuthorized(d.invoiceId,d.actorId))){
      const e=new Error('qa_invoice_denied');e.code='FORBIDDEN';throw e;
     }
     prepared={...d,...await db.prepareSaasPayment(d)};
     return prepared;
    },
    attachSaasPaymentIntent:async d=>{
     if(!prepared || d.attemptId!==prepared.attemptId ||
       d.actorId!==prepared.actorId ||
       !(await invoiceAuthorized(prepared.invoiceId,prepared.actorId))){
      const e=new Error('qa_invoice_denied');e.code='FORBIDDEN';throw e;
     }
     return db.attachSaasPaymentIntent(d);
    },
   };
   return createBillingPaymentApi({
     authenticate:async token=>{
      const user=await authenticate(token);
      return user?.isQa===true?user:null;
     },
     db:guardedDb,payments:payments||
       createStripeTestPaymentIntents(env.STRIPE_SECRET_KEY),enabled:true,
   })(request);
  }
  if(path==='/api/webhooks/stripe'){
   return createStripeWebhookApi({
    secret:env.STRIPE_WEBHOOK_SECRET,
    processTestPayments:sharedProjectQaReconciliationEligible(env),
    verifyEventScope:async event=>{
     if(event.type!=='payment_intent.succeeded')return false;
     const proof=paidStripeEvidence(event);
     return Boolean(proof)&&await invoiceAuthorized(proof.invoiceId);
    },
    db:{
     recordStripeEvent: d=>db.recordStripeEvent(d),
     reconcileSaasPaid:async proof=>{
      if(!(await invoiceAuthorized(proof.invoiceId)))
       throw new Error('qa_invoice_denied');
      return db.reconcileSaasPaid(proof);
     },
    },
   })(request);
  }
  return new Response(JSON.stringify({error:'not_found'}),{
   status:404,headers:{'content-type':'application/json','cache-control':'no-store'},
  });
 };
}
