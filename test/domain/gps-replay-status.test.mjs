import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029181000_gps_attendance_pending.sql',import.meta.url),'utf8');
test('GPS idempotency replay reports current DB review status and keeps face verification false',()=>{
 assert.match(sql,/SELECT a\.review_status,a\.geofence_status/);
 assert.match(sql,/v_saved_status/);
 assert.match(sql,/v_saved_geofence/);
 assert.match(sql,/replayed',true,'faceVerified',false/);
 assert.doesNotMatch(sql,/status','pending','replayed',true/);
});
test('GPS event remains pending until another independent authority reviews it',()=>{
 assert.match(sql,/v_status,'pending',clock_timestamp\(\)/);
 assert.match(sql,/faceVerified',false/);
});
