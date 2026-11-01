// Stripe test-only operations MUST use an independently isolated UAT database.
// A production-preview Worker may never be used as the backing ledger for
// test-mode SaaS invoices, even if somebody toggles two Stripe switches.
const LIVE_REF='cxihsotcpdnalswfoysx';
const REF=/^[a-z0-9]{20}$/;
const TEST_SECRET=/^sk_test_[A-Za-z0-9_]{12,}$/;
const TEST_PUBLIC=/^pk_test_[A-Za-z0-9_]{12,}$/;
const WEBHOOK=/^whsec_[A-Za-z0-9_]{12,}$/;
export function stripeTestProviderEligible(env){
 const ref=env?.OILSTATION_UAT_SUPABASE_REF;
 return env?.OILSTATION_DEPLOY_TARGET==='uat' &&
   env?.OILSTATION_API_ENABLED==='true' &&
   // Never mix the transitional shared-project pilot with isolated financial writes.
   env?.OILSTATION_SHARED_QA_BILLING_ENABLED!=='true' &&
   env?.STRIPE_TEST_PAYMENTS_ENABLED==='true' &&
   typeof ref==='string'&&REF.test(ref)&&ref!==LIVE_REF &&
   (env.SUPABASE_URL==='https://'+ref+'.supabase.co' ||
    env.SUPABASE_URL==='https://'+ref+'.supabase.co/') &&
   TEST_SECRET.test(env.STRIPE_SECRET_KEY||'') &&
   TEST_PUBLIC.test(env.STRIPE_PUBLISHABLE_KEY||'') &&
   WEBHOOK.test(env.STRIPE_WEBHOOK_SECRET||'');
}
export function stripeTestReconciliationEligible(env){
 return stripeTestProviderEligible(env)&&
  env.STRIPE_TEST_RECONCILIATION_ENABLED==='true';
}

// Explicit opt-in paths for provider-confirmed test refunds and dispute
// history. These must NEVER activate for the shared, production-backed pilot.
// Stripe TEST provider + signed payment reconciliation must already be ready.
export function stripeTestRefundReconciliationEligible(env){
 return stripeTestReconciliationEligible(env) &&
   env?.STRIPE_TEST_REFUNDS_ENABLED==='true';
}
export function stripeTestDisputeReviewEligible(env){
 return stripeTestReconciliationEligible(env) &&
   env?.STRIPE_TEST_DISPUTE_REVIEW_ENABLED==='true';
}

// User-approved same-project pilot. Unlike the standard isolated UAT path,
// this mode is ONLY allowed while the general business API stays disabled.
// A separate SQL scope attestation must also authorize EVERY invoice/actor.
export function sharedProjectQaStripeEligible(env){
 return env?.OILSTATION_DEPLOY_TARGET==='uat' &&
   env?.OILSTATION_API_ENABLED==='false' &&
   env?.OILSTATION_SHARED_QA_BILLING_ENABLED==='true' &&
   env?.OILSTATION_QA_MODE_ENABLED==='true' &&
   env?.OILSTATION_QA_RUN_ID==='QA-20261031-PLATFORM-001' &&
   env?.OILSTATION_QA_STRIPE_STATION_ID==='e22fb5ff-1878-446f-ab8d-585115e8a1a9' &&
   env?.OILSTATION_SHARED_SUPABASE_REF===LIVE_REF &&
   (env?.SUPABASE_URL==='https://'+LIVE_REF+'.supabase.co' ||
    env?.SUPABASE_URL==='https://'+LIVE_REF+'.supabase.co/') &&
   env?.STRIPE_TEST_PAYMENTS_ENABLED==='true' &&
   TEST_SECRET.test(env?.STRIPE_SECRET_KEY||'') &&
   TEST_PUBLIC.test(env?.STRIPE_PUBLISHABLE_KEY||'') &&
   WEBHOOK.test(env?.STRIPE_WEBHOOK_SECRET||'');
}
export function sharedProjectQaReconciliationEligible(env){
 return sharedProjectQaStripeEligible(env) &&
   env?.STRIPE_TEST_RECONCILIATION_ENABLED==='true';
}
