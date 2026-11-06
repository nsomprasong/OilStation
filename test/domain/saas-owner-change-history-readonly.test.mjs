import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261106153000_station_saas_owner_change_history_readonly.sql',import.meta.url),'utf8');
test('history RPC is owner only, station scoped and bounded',()=>{
 assert.match(sql,/m\.user_id=p_actor_id AND m\.active/);
 assert.match(sql,/m\.station_id=p_station_id AND m\.role_code IN \('station_owner','owner'\)/);
 assert.match(sql,/WHERE station_id=p_station_id/);
 assert.match(sql,/ORDER BY created_at DESC,id DESC LIMIT 20/);
 assert.match(sql,/'recentChanges',v_recent_changes/);
});
test('history RPC read-only and no direct anonymous authorization',()=>{
 assert.match(sql,/LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.station_saas_plan_options\(uuid,uuid\)/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.station_saas_plan_options\(uuid,uuid\) TO service_role/);
 assert.doesNotMatch(sql,/\bINSERT INTO\b|\bUPDATE public\.\w+|\bDELETE FROM\b/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION.*TO (?:anon|authenticated)/);
});
