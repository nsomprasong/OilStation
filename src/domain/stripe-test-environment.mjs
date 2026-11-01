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
