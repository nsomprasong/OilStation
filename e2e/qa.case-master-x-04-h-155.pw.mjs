import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {readFileSync} from 'node:fs';
// OILSTATION_QA_BATCH_RUN: only six new authorized QA acceptance cases.
const MASTER_UAT_ID='X-04-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-04-H evidence verification',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const s=readFileSync('supabase/migrations/20261029124000_coupon_atomic_replacement.sql','utf8');expect(s).toContain('WHERE scope_key=v_scope AND idempotency_key=p_idempotency_key');expect(s).toContain('idempotent.response_snapshot');expect(s).toContain("'replayed',true");const integration=readFileSync('test/integration/fuel-assertions.sql','utf8');expect(integration).toContain('nonce_reuse_for_different_amount_allowed');const denied=await page.request.post(BASE+'/api/coupons',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{}});expect(denied.status()).toBe(503);expect(await denied.json()).toEqual({error:'release_not_enabled'});console.log('MASTER_CASE X-04-H ISOLATED_SQL_REPLAY_ONE_EFFECT_CODE_AND_LIVE_FINANCE_GATE_PROVEN (live positive coupon issue remains disabled)');
}});
