import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripeTestProviderEligible,stripeTestReconciliationEligible,
 stripeTestRefundReconciliationEligible,stripeTestDisputeReviewEligible} from '../../src/domain/stripe-test-environment.mjs';

const ref='abcdefghijklmnopqrst';
const safe={
 OILSTATION_DEPLOY_TARGET:'uat',
 OILSTATION_UAT_SUPABASE_REF:ref,
 SUPABASE_URL:'https://'+ref+'.supabase.co',
 OILSTATION_API_ENABLED:'true',
 STRIPE_TEST_PAYMENTS_ENABLED:'true',
 STRIPE_TEST_RECONCILIATION_ENABLED:'true',
 STRIPE_SECRET_KEY:'sk_test_abcdefghijklmnopqrst',
 STRIPE_PUBLISHABLE_KEY:'pk_test_abcdefghijklmnopqrst',
 STRIPE_WEBHOOK_SECRET:'whsec_abcdefghijklmnopqrst',
};
test('isolated UAT with test-only Stripe keys is required for test provider and signed-event reconciliation',()=>{
 assert.equal(stripeTestProviderEligible(safe),true);
 assert.equal(stripeTestReconciliationEligible(safe),true);
 assert.equal(stripeTestReconciliationEligible({...safe,STRIPE_TEST_RECONCILIATION_ENABLED:'false'}),false);
});
test('production project or Worker cannot enable test invoices even with every Stripe flag and test key set',()=>{
 const variants=[
  {OILSTATION_DEPLOY_TARGET:'production'},
  {OILSTATION_UAT_SUPABASE_REF:'cxihsotcpdnalswfoysx',
   SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co'},
  {SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co'},
  {SUPABASE_URL:'https://forbidden.supabase.co'},
  {OILSTATION_UAT_SUPABASE_REF:''},
  {OILSTATION_API_ENABLED:'false'},
  {STRIPE_TEST_PAYMENTS_ENABLED:'false'},
  {STRIPE_SECRET_KEY:'sk_live_invalidmustnotallow'},
  {STRIPE_WEBHOOK_SECRET:''},
  {STRIPE_WEBHOOK_SECRET:'whsec_invalid'},
  {STRIPE_PUBLISHABLE_KEY:'pk_live_invalidmustnotallow'},
  {STRIPE_TEST_RECONCILIATION_ENABLED:'false'},
 ];
 for(const change of variants){
  const env={...safe,...change};
  if(change.STRIPE_TEST_RECONCILIATION_ENABLED==='false'){
   assert.equal(stripeTestProviderEligible(env),true);
  }else{
   assert.equal(stripeTestProviderEligible(env),false,JSON.stringify(change));
  }
  assert.equal(stripeTestReconciliationEligible(env),false,JSON.stringify(change));
 }
});
test('production preview defaults to disabled, and both worker routes apply the same independent UAT guard',()=>{
 const wrangler=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(wrangler.vars.OILSTATION_API_ENABLED,'false');
 assert.equal(wrangler.vars.OILSTATION_QA_FINANCE_SIM_ENABLED,'false');
 assert.equal(wrangler.vars.STRIPE_TEST_PAYMENTS_ENABLED,undefined);
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 assert.match(worker,/const enabled=stripeTestProviderEligible\(env\)/);
 assert.match(worker,/if\(!stripeTestProviderEligible\(env\)\)/);
 assert.match(worker,/processTestPayments:stripeTestReconciliationEligible\(env\)/);
 assert.match(worker,/stripePublishableKey:stripeTestProviderEligible\(env\)/);
});

test('refund and dispute webhooks require an independent UAT project and explicit opt-in',()=>{
 const enabled={...safe,STRIPE_TEST_REFUNDS_ENABLED:'true',
  STRIPE_TEST_DISPUTE_REVIEW_ENABLED:'true'};
 assert.equal(stripeTestRefundReconciliationEligible(enabled),true);
 assert.equal(stripeTestDisputeReviewEligible(enabled),true);
 assert.equal(stripeTestRefundReconciliationEligible(safe),false);
 assert.equal(stripeTestDisputeReviewEligible(safe),false);
 const forbidden=[
  {OILSTATION_DEPLOY_TARGET:'production'},
  {OILSTATION_API_ENABLED:'false'},
  {OILSTATION_SHARED_QA_BILLING_ENABLED:'true'},
  {OILSTATION_UAT_SUPABASE_REF:'cxihsotcpdnalswfoysx',
   SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co'},
  {SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co'},
  {STRIPE_SECRET_KEY:'sk_live_abcdefghijklmnopqrst'},
  {STRIPE_TEST_RECONCILIATION_ENABLED:'false'},
 ];
 for(const change of forbidden){
  const env={...enabled,...change};
  assert.equal(stripeTestRefundReconciliationEligible(env),false,JSON.stringify(change));
  assert.equal(stripeTestDisputeReviewEligible(env),false,JSON.stringify(change));
 }
 assert.equal(stripeTestRefundReconciliationEligible({
  ...enabled,STRIPE_TEST_REFUNDS_ENABLED:'false'}),false);
 assert.equal(stripeTestDisputeReviewEligible({
  ...enabled,STRIPE_TEST_DISPUTE_REVIEW_ENABLED:'false'}),false);
});
test('production and transitional shared UAT configs cannot activate new financial paths',()=>{
 const wrangler=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8'));
 const production=wrangler.vars, shared=wrangler.env.uat.vars;
 assert.equal(production.OILSTATION_API_ENABLED,'false');
 assert.equal(shared.OILSTATION_API_ENABLED,'false');
 assert.equal(shared.OILSTATION_SHARED_QA_BILLING_ENABLED,'true');
 for(const key of ['STRIPE_TEST_REFUNDS_ENABLED','STRIPE_TEST_DISPUTE_REVIEW_ENABLED']){
  assert.notEqual(production[key],'true');
  assert.notEqual(shared[key],'true');
 }
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 assert.match(worker,/processTestRefunds:stripeTestRefundReconciliationEligible\(env\)/);
 assert.match(worker,/processTestDisputes:stripeTestDisputeReviewEligible\(env\)/);
});
