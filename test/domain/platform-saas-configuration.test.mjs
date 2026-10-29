import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029203000_platform_saas_configuration.sql',import.meta.url),'utf8');
test('tax is explicitly reviewed, never hardcoded as legal default',()=>{
 assert.match(sql,/saas_tax_review_policies/);
 assert.match(sql,/approved_by uuid NOT NULL/);
 assert.match(sql,/p_rate_basis_points NOT BETWEEN 0 AND 10000/);
 assert.doesNotMatch(sql,/DEFAULT 700/);
});
test('group stations must have identical owner and autopay is unchecked',()=>{
 assert.match(sql,/s\.organization_id=p_organization_id/);
 assert.match(sql,/v_count<>cardinality\(p_station_ids\)/);
 assert.match(sql,/autopay_consent,status/);
 assert.match(sql,/false,'active'/);
 assert.match(sql,/count\(DISTINCT x\)/);
});
test('every privileged config routine is service-only',()=>{
 for(const name of ['platform_define_saas_flat_plan','platform_review_saas_tax_policy',
 'platform_create_saas_billing_group','platform_subscribe_saas_station']){
  assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+name));
  assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+name));
 }
 assert.match(sql,/role_code='platform_superadmin'/);
});
