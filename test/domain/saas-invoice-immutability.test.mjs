import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../../supabase/migrations/20261029202000_saas_invoice_immutability.sql',import.meta.url),'utf8');
test('financial invoice fields and line items freeze at issuance, even for privileged updates',()=>{
 assert.match(migration,/OLD\.status<>'draft'/);
 for(const field of ['billing_group_id','subtotal_satang','discount_satang',
    'tax_satang','total_satang','pricing_snapshot'])
  assert.match(migration,new RegExp('NEW\\.'+field+' IS DISTINCT FROM OLD\\.'+field));
 assert.match(migration,/BEFORE INSERT OR UPDATE OR DELETE ON public\.saas_invoice_lines/);
 assert.match(migration,/v_status IS DISTINCT FROM 'draft'/);
});
test('PaymentIntent reference, idempotency key and money cannot be reassigned',()=>{
 for(const field of ['invoice_id','payment_method','amount_satang','idempotency_key'])
  assert.match(migration,new RegExp('NEW\\.'+field+' IS DISTINCT FROM OLD\\.'+field));
 assert.match(migration,/OLD\.stripe_payment_intent_id IS NOT NULL/);
 assert.match(migration,/PAID_PAYMENT_ATTEMPT_LOCKED/);
});
