import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const gate=readFileSync(new URL('../../supabase/migrations/20261029209000_private_topup_finance_gate.sql',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../../src/adapters/supabase.mjs',import.meta.url),'utf8');
test('legacy topup settlement cannot be invoked by Worker service role',()=>{
 assert.match(gate,/REVOKE ALL ON FUNCTION public\.review_corporate_topup/);
 assert.match(gate,/service_role/);
});
test('Worker routes only through independently verified topup review',()=>{
 assert.match(adapter,/\/rest\/v1\/rpc\/review_verified_corporate_topup/);
 assert.equal(adapter.includes("'/rest/v1/rpc/review_corporate_topup'"),false);
});
