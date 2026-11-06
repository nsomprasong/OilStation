import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261106160000_station_saas_schedule_cancel.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../src/client/station-plan-choice.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../../src/adapters/supabase.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
test('scheduling and cancellation are owner-scoped under row locks',()=>{
 assert.match(sql,/m\.station_id=p_station_id AND m\.role_code IN \('station_owner','owner'\)/);
 assert.equal((sql.match(/FOR UPDATE/g)||[]).length>=4,true);
 assert.match(sql,/v_sub\.current_period_end<=clock_timestamp\(\)/);
 assert.match(sql,/p_effective_at<>v_sub\.current_period_end/);
 assert.match(sql,/status='pending'/);
 assert.match(sql,/payment_status<>'unconfirmed'/);
});
test('new scheduling does not charge or activate an entitlement',()=>{
 assert.doesNotMatch(sql,/UPDATE public\.station_subscriptions|UPDATE public\.station_modules|UPDATE public\.saas_invoices/);
 assert.doesNotMatch(sql,/INSERT INTO public\.saas_payment_attempts/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.station_saas_schedule_change.*TO service_role/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.station_saas_cancel_change.*TO service_role/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION.*TO (?:anon|authenticated)/);
});
test('Worker routes and Adapter bind schedule/cancel to trusted RPCs',()=>{
 for(const path of ['/api/station/billing/change/schedule','/api/station/billing/change/cancel']){
  assert.ok(worker.includes(path));
  assert.ok(ui.includes(path));
 }
 assert.match(adapter,/rpc\/station_saas_schedule_change/);
 assert.match(adapter,/rpc\/station_saas_cancel_change/);
});
