import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(
 new URL('../../supabase/migrations/20261106150000_station_subscription_change_request_shell.sql',import.meta.url),
 'utf8');

test('SaaS history shell has immutable original and replacement plan references plus effect instant',()=>{
 for(const pattern of [
  /current_subscription_id uuid NOT NULL REFERENCES public\.station_subscriptions\(id\)/,
  /current_plan_id uuid NOT NULL REFERENCES public\.pricing_plans\(id\)/,
  /next_plan_id uuid NOT NULL REFERENCES public\.pricing_plans\(id\)/,
  /old_period_end_snapshot timestamptz NOT NULL/,
  /requested_effective_at timestamptz NOT NULL/,
  /price_snapshot jsonb NOT NULL/,
  /requested_by uuid NOT NULL REFERENCES public\.app_users\(id\)/,
 ])assert.match(sql,pattern);
});
test('SaaS scheduled change is one pending per station and same key cannot multiply rows',()=>{
 assert.match(sql,/UNIQUE \(station_id,idempotency_key\)/);
 assert.match(sql,/UNIQUE INDEX IF NOT EXISTS saas_change_one_pending_per_station/);
 assert.match(sql,/WHERE status='pending'/);
 assert.match(sql,/requested_effective_at >= old_period_end_snapshot/);
});
test('SaaS scheduled change table is deny-by-default with no write or public grants',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.station_subscription_change_requests\s+FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON TABLE public\.station_subscription_change_requests TO service_role/);
 assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE|ALL) ON TABLE/i);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE public\.station_subscriptions|DELETE FROM)\b/i);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION/i);
});
test('SaaS intent does not have a hidden active-by-default or paid-by-default state',()=>{
 assert.match(sql,/status text NOT NULL DEFAULT 'pending'/);
 assert.match(sql,/payment_status text NOT NULL DEFAULT 'unconfirmed'/);
 assert.match(sql,/saas_change_status_timestamp CHECK/);
 assert.match(sql,/saas_change_price_snapshot_required CHECK/);
});
