import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../../supabase/migrations/20261029214000_hr_owner_shift_scope.sql',import.meta.url),'utf8');
test('both HR shift writers authorize only owner of station organization',()=>{
 assert.equal((s.match(/m\.scope_type='organization'/g)||[]).length,2);
 assert.equal((s.match(/m\.organization_id=/g)||[]).length,2);
 assert.match(s,/s\.id=p_station_id/);
 assert.match(s,/s\.id=v_station/);
 assert.match(s,/m\.role_code IN \('organization_owner','owner'\)/);
});
test('updated HR shift routines remain service-role only',()=>{
 assert.match(s,/REVOKE ALL ON FUNCTION public\.hr_seed_shift_templates/);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.hr_assign_shift/);
 assert.match(s,/TO service_role/);
});
