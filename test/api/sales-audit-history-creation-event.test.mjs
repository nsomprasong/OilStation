import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file='supabase/migrations/20261031181000_sales_audit_history_creation_event.sql';
const sql=readFileSync(file,'utf8');
const e2e=readFileSync('e2e/platform.qa.pw.mjs','utf8');
test('Sales Activity recognizes both canonical station creation audit names',()=>{
 assert.match(sql,/a\.action IN \('station_created','sales_station_created'\)/);
 assert.match(sql,/e\.action IN \('station_created','sales_station_created'\)/);
 assert.match(sql,/m\.role_code='platform_sales'/);
 assert.match(sql,/a\.sales_user_id=m\.user_id/);
 assert.match(sql,/e\.station_id=p_station_id/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.platform_sales_activity_history/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT SELECT ON|INSERT INTO|DELETE FROM|UPDATE public\./i);
 assert.match(e2e,/P-14 Sales own-activity and cross-tenant denial @sales-scope/);
 assert.match(e2e,/blockedInspect\.status\(\)\)\.toBe\(403\)/);
 assert.match(e2e,/blockedActivity\.status\(\)\)\.toBe\(403\)/);
});
