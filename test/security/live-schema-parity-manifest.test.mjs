import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('live-shaped fixture includes RLS, original RPCs and actual table ACLs',()=>{
 const schema=readFileSync(new URL('../integration/live-public-schema-fixture.sql',import.meta.url),'utf8');
 const funcs=readFileSync(new URL('../integration/live-public-functions-fixture.sql',import.meta.url),'utf8');
 const grants=readFileSync(new URL('../integration/live-public-table-grants.sql',import.meta.url),'utf8');
 const manifest=JSON.parse(readFileSync(new URL('../integration/live-public-schema-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.tableCount,65);
 assert.equal(manifest.columnCount,552);
 assert.equal(manifest.constraintCount,340);
 assert.equal(manifest.includesCustomerRows,false);
 assert.equal((schema.match(/CREATE TABLE public\./g)||[]).length,65);
 assert.equal((schema.match(/FORCE ROW LEVEL SECURITY/g)||[]).length,65);
 assert.ok((funcs.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length>=30);
 assert.equal((grants.match(/GRANT SELECT ON public\./g)||[]).length,4);
 assert.doesNotMatch(schema,/INSERT INTO public\./);
 assert.doesNotMatch(funcs,/sk_live_|sk_test_|SUPABASE_SERVICE_ROLE_KEY/);
});
