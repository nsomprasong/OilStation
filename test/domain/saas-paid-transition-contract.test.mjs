import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const activation=read('20261106170000_station_saas_paid_activation.sql');
const group=read('20261106175500_saas_change_group_invoice.sql');
const choice=read('20261106174000_station_saas_explicit_modules.sql');
const quote=read('20261106173000_station_saas_module_quote.sql');
const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');

test('due transition requires verified paid invoice and succeeded settled provider attempt',()=>{
 assert.match(activation,/v_invoice\.status<>'paid'/);
 assert.match(activation,/v_invoice\.paid_at IS NULL/);
 assert.match(activation,/a\.status='succeeded'/);
 assert.match(activation,/a\.settled_at IS NOT NULL/);
 assert.match(activation,/a\.stripe_payment_intent_id IS NOT NULL/);
 assert.match(activation,/requested_effective_at<=clock_timestamp\(\)/);
 assert.match(activation,/v_old\.current_period_end<>c\.requested_effective_at/);
});
test('paid plan and selected entitlements transition atomically and replay cannot duplicate',()=>{
 assert.match(activation,/UPDATE public\.station_subscriptions SET status='cancelled'/);
 assert.match(activation,/INSERT INTO public\.station_subscriptions/);
 assert.match(activation,/UPDATE public\.station_modules SET status='disabled'/);
 assert.match(activation,/FOREACH v_module IN ARRAY c\.target_modules/);
 assert.match(activation,/ON CONFLICT \(station_id,module_code\) DO UPDATE/);
 assert.match(activation,/SET status='applied',payment_status='confirmed'/);
 assert.match(activation,/WHERE x\.station_id=v_station\.id AND x\.status='pending'/);
});
test('owner selected QR and HR module quote has canonical validated module list',()=>{
 assert.match(choice,/CREATE OR REPLACE FUNCTION public\.station_saas_schedule_change_v2/);
 assert.match(choice,/target_modules\)/);
 assert.match(quote,/CREATE OR REPLACE FUNCTION public\.station_plan_quote_for_modules/);
 assert.match(quote,/cardinality\(p_target_modules\)/);
 assert.match(ui,/\/api\/station\/billing\/change\/quote/);
 assert.match(ui,/targetModules:selectedModules\(\)/);
});
test('only protected cron can activate, normal browsing/quote cannot',()=>{
 assert.match(worker,/OILSTATION_SAAS_TRANSITION_ENABLED==='true'/);
 assert.match(worker,/db\.applyDueSaasChanges\(20\)/);
 assert.match(worker,/if \(env\.OILSTATION_API_ENABLED !== 'true'\) return/);
 assert.doesNotMatch(ui,/\/api\/station\/billing\/change\/activate/);
});
test('group invoice uses saved quote with immutable amount and links pending requests',()=>{
 assert.match(group,/CREATE OR REPLACE FUNCTION public\.platform_issue_saas_change_group_invoice/);
 assert.match(group,/role_code='platform_superadmin'/);
 assert.match(group,/payment_status<>'unconfirmed'/);
 assert.match(group,/pricing_snapshot/);
 assert.match(group,/INSERT INTO public\.saas_invoices/);
 assert.match(group,/INSERT INTO public\.saas_invoice_lines/);
 assert.match(group,/payment_invoice_id=v_id/);
 assert.match(group,/TO service_role;/);
 assert.doesNotMatch(group,/TO (?:anon|authenticated);/);
});
