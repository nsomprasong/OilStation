import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../../supabase/migrations/20261029211000_forward_fuel_finance_replay_auth.sql',import.meta.url),'utf8');
test('forward migration replaces already-applied fuel settlement function',()=>{
 const prior=migration.indexOf('m.station_id=s.station_id');
 const replay=migration.indexOf("IF c.status='completed' AND s.status='completed' THEN");
 assert.ok(prior>0&&prior<replay);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.finish_reserved_fuel_session\(/);
 assert.match(migration,/service_role/);
});
test('forward settlement keeps exact wallet and debt ledger paths',()=>{
 for(const term of ['v_prepaid_used:=least(a.prepaid_balance_satang,v_net)',
  'debt_outstanding_satang=debt_outstanding_satang+v_debt',
  'UPDATE public.credit_reservations SET consumed_satang=v_net',
  'INSERT INTO public.wallet_ledger','INSERT INTO public.accounts_receivable'])
  assert.ok(migration.includes(term),term);
});
