import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('station bundle price is used only when both services are enabled',()=>{
 const migration=readFileSync(new URL('../../supabase/migrations/20261030170000_saas_bundle_price_and_plan_archive.sql',import.meta.url),'utf8');
 assert.match(migration,/v_modules=2/);
 assert.match(migration,/sm\.module_code='qr_coupon'/);
 assert.match(migration,/sm\.module_code='hr_payroll'/);
 assert.match(migration,/pr\.billing_method='bundle'/);
 assert.match(migration,/v_subtotal:=v_bundle/);
 assert.match(migration,/v_bundle_applied:=true/);
 assert.match(migration,/public\.pricing_plans SET active=false/);
 assert.match(migration,/status='pending_payment'/);
 assert.match(migration,/p\.active/);
});
