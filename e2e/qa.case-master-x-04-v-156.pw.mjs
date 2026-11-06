import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {readFileSync} from 'node:fs';
// OILSTATION_QA_BATCH_RUN: only six new authorized QA acceptance cases.
const MASTER_UAT_ID='X-04-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-04-V evidence verification',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const migration=readFileSync('supabase/migrations/20261029124000_coupon_atomic_replacement.sql','utf8');expect(migration).toContain('IF idempotent.request_hash<>v_hash THEN');expect(migration).toContain("MESSAGE='IDEMPOTENCY_CONFLICT'");const sql=readFileSync('test/integration/fuel-assertions.sql','utf8');expect(sql).toContain('nonce_reuse_for_different_amount_allowed');const ready=await page.request.get(BASE+'/api/ready');expect(ready.status()).toBe(503);expect((await ready.json()).ready).toBe(false);console.log('MASTER_CASE X-04-V CHANGED_KEY_PAYLOAD_SQL_CONFLICT_GUARD_AND_PREVIEW_BLOCKED_PASS (live mismatch write not exercised)');
}});
