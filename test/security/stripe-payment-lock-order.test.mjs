import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../supabase/migrations/20261029195000_saas_test_payment_intent.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const attach=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.attach_saas_test_intent('));
test('all payment paths lock invoice before attempt; attach cannot deadlock with prepare or reconciliation',()=>{
 const first=attach.indexOf('FROM public.saas_payment_attempts\n  WHERE id=p_attempt_id;');
 const invoiceLock=attach.indexOf('FROM public.saas_invoices WHERE id=v_invoice_id FOR UPDATE;');
 const attemptLock=attach.indexOf('WHERE id=p_attempt_id AND invoice_id=i.id FOR UPDATE;');
 assert.ok(first>=0&&invoiceLock>first&&attemptLock>invoiceLock);
 assert.doesNotMatch(attach,/WHERE id=p_attempt_id FOR UPDATE/);
});
test('payment intent attachment rejects paid invoices, switched amounts, or changed attempts',()=>{
 assert.match(attach,/i.status NOT IN \('issued','pending','overdue'\)/);
 assert.match(attach,/a.amount_satang<>i.total_satang/);
 assert.match(attach,/a.status NOT IN \('created','requires_action','processing'\)/);
});
