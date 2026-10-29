import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029212000_core_workload_indexes.sql',import.meta.url),'utf8');
test('index migration uses additive names and avoids destructive table work',()=>{
 assert.equal((sql.match(/CREATE INDEX IF NOT EXISTS/g)||[]).length,13);
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER TABLE)\b/i);
 for(const name of ['accounts_receivable','corporate_station_accounts','coupons',
  'fuel_evidence','fuel_sessions','topup_requests','saas_payment_attempts',
  'memberships','attendance_events','shift_assignments'])
  assert.ok(sql.includes('public.'+name+'('));
});
