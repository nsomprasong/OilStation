import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261031173000_oilstation_qa_platform_evidence.sql','utf8');
const e2e = readFileSync('e2e/platform.qa.pw.mjs','utf8');

test('QA evidence uses narrow read-only RPC rather than direct restricted table GET',()=>{
  assert.match(sql,/oilstation_qa_platform_evidence\(p_qa_run_id text\)/);
  assert.match(sql,/SECURITY DEFINER SET search_path=''/i);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.oilstation_qa_platform_evidence\(text\)/i);
  assert.match(sql,/FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.oilstation_qa_platform_evidence\(text\)/);
  assert.match(sql,/TO service_role/);
  assert.doesNotMatch(sql,/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON\s+(?:TABLE|public\.)/i);
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
  assert.match(e2e,/rest\/v1\/rpc\/oilstation_qa_platform_evidence/);
  assert.doesNotMatch(e2e,/readRows\('stations'/);
  assert.doesNotMatch(e2e,/rest\/v1\/stations/);
});
