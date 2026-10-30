import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029204000_saas_flat_invoice_draft.sql',import.meta.url),'utf8');
test('no arbitrary client price and no invoice outside a configured group or eligible station module',()=>{
 assert.match(sql,/FROM public\.pricing_rules pr/);
 assert.match(sql,/AND sm\.status='enabled'/);
 assert.match(sql,/v_stations<>\(SELECT count\(\*\) FROM public\.billing_group_stations/);
 assert.match(sql,/rule_record\.price_satang/);
 assert.match(sql,/policy\.rate_basis_points/);
 assert.match(sql,/vatMode/);
});
test('group and period locking prevent duplicate invoice issuance or double charge',()=>{
 assert.match(sql,/UNIQUE\(billing_group_id,service_start,service_end\)/);
 assert.match(sql,/FROM public\.billing_groups WHERE id=p_billing_group_id FOR UPDATE/);
 assert.match(sql,/RETURN jsonb_build_object\('invoiceId',v_invoice\.id,'status',v_invoice\.status/);
 assert.match(sql,/i\.status='issued' THEN RETURN/);
 assert.doesNotMatch(sql,/UPDATE public\.corporate_station_accounts/);
 assert.doesNotMatch(sql,/commission_ledger/);
});
test('discount and tax split exactly and freeze service dates for future commission',()=>{
 assert.match(sql,/v_cumulative_price/);
 assert.match(sql,/v_prev_discount<>v_discount OR v_prev_tax<>v_tax/);
 assert.match(sql,/commissionBaseSatang/);
 assert.match(sql,/serviceStart/);
 assert.match(sql,/serviceEnd/);
});
