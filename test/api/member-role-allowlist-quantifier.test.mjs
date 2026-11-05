import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../../supabase/migrations/20261105103500_member_role_allowlist_quantifier_fix.sql',import.meta.url),'utf8');
test('scoped member SQL uses ALL to reject only outside-allowlist roles',()=>{
 assert.match(migration,/p_role_code<>ALL\(v_roles\)/);
 assert.doesNotMatch(migration,/p_role_code<>ANY\(v_roles\)/);
 assert.match(migration,/v_m\.role_code<>ALL\(v_roles\)/);
 assert.match(migration,/a\.role_code IN \('station_owner','owner'\)/);
 assert.match(migration,/SECURITY DEFINER SET search_path = ''/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.oilstation_scoped_member_change/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.oilstation_scoped_member_change/);
 assert.match(migration,/INSERT INTO public\.audit_events/);
});
