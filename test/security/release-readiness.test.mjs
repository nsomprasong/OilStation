import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../../supabase/migrations/20261029215000_release_readiness.sql',import.meta.url),'utf8');
test('release readiness requires private evidence and slip buckets, RLS and latest business RPCs',()=>{
 assert.match(s,/v_tables>=66 AND v_missing=0/);
 assert.match(s,/oilstation-evidence/);assert.match(s,/oilstation-slips/);
 assert.match(s,/complete_reviewed_fuel_session/);
 assert.match(s,/confirm_invited_email_otp/);
 assert.match(s,/reconcile_saas_test_paid_event/);
 assert.match(s,/hr_reviewed_attendance_punches_local/);
 assert.match(s,/review_corporate_topup/);
 assert.match(s,/finish_reserved_fuel_session/);
});
test('release probe is read-only, service-role only, fixed search path',()=>{
 assert.match(s,/STABLE SECURITY DEFINER SET search_path=''/);
 assert.doesNotMatch(s,/\b(?:UPDATE|INSERT|DELETE FROM|DROP TABLE|TRUNCATE TABLE)\b/i);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.oilstation_release_status\(\)/);
 assert.match(s,/TO service_role/);
});
