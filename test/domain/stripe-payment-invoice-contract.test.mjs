import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029195000_saas_test_payment_intent.sql',import.meta.url),'utf8');
test('invoice-sourced Stripe amount cannot include unrelated tenant or missing line items',()=>{
 assert.match(sql,/public\.billing_group_stations bgs/);
 assert.match(sql,/bgs\.billing_group_id=i\.billing_group_id/);
 assert.match(sql,/NOT EXISTS\(SELECT 1 FROM public\.saas_invoice_lines/);
 assert.match(sql,/i\.total_satang<>i\.subtotal_satang-i\.discount_satang/);
 assert.match(sql,/i\.pricing_snapshot->>'vatMode'/);
});
test('abandoned unbound Stripe idempotency key cannot be replayed after retention expiry',()=>{
 assert.match(sql,/a\.stripe_payment_intent_id IS NULL/);
 assert.match(sql,/interval '20 hours'/);
 assert.match(sql,/i\.pricing_snapshot->>'paymentMethod'/);
});
