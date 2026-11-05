import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../../supabase/migrations/20261105103500_member_role_allowlist_quantifier_fix.sql',import.meta.url),'utf8');
// Evaluate executable SQL only; historical unsafe text is intentionally mentioned in comments.
const executable=migration.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
test('scoped member SQL uses ALL to reject only outside-allowlist roles',()=>{
 assert.match(executable,/p_role_code<>ALL\(v_roles\)/);
 assert.doesNotMatch(executable,/p_role_code<>ANY\(v_roles\)/);
 assert.match(executable,/v_m\.role_code<>ALL\(v_roles\)/);
 assert.match(executable,/a\.role_code IN \('station_owner','owner'\)/);
 assert.match(executable,/SECURITY DEFINER SET search_path = ''/);
 assert.match(executable,/REVOKE ALL ON FUNCTION public\.oilstation_scoped_member_change/);
 assert.match(executable,/GRANT EXECUTE ON FUNCTION public\.oilstation_scoped_member_change/);
 assert.match(executable,/INSERT INTO public\.audit_events/);
});
