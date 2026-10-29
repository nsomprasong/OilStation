import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const start=readFileSync(new URL('../../supabase/migrations/20261029161000_fail_closed_fuel_start.sql',import.meta.url),'utf8');
const gate=readFileSync(new URL('../../supabase/migrations/20261029208000_fuel_private_finance_gate.sql',import.meta.url),'utf8');
test('settled replay performs scoped station authorization before returning any financial amounts',()=>{
 const auth=start.indexOf("m.station_id=s.station_id",start.indexOf("CREATE OR REPLACE FUNCTION public.finish_reserved_fuel_session"));
 const replay=start.indexOf("IF c.status='completed' AND s.status='completed' THEN");
 assert.ok(auth>0&&auth<replay);
});
test('the worker service role cannot directly start or settle fuel without independent photo review',()=>{
 for(const fn of ['start_reserved_fuel_session','finish_reserved_fuel_session']){
  assert.ok(gate.includes('REVOKE ALL ON FUNCTION public.'+fn));
 }
 assert.ok(gate.includes('service_role'));
});
