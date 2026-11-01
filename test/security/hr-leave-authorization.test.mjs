import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('scoped leave database RPCs require station/employee ACL and distinct reviewer',()=>{
 const sql=read('supabase/migrations/20261101210000_hr_leave_safe_request_review.sql');
 for(const phrase of ['FORCE ROW LEVEL SECURITY','p_actor_id IS DISTINCT FROM e.user_id',
 'p_actor_id IS NOT DISTINCT FROM l.requested_by','p_actor_id IS NOT DISTINCT FROM e.user_id',
 'pg_advisory_xact_lock','l.status IN (','OVERLAPPING_LEAVE','SELF_APPROVAL_FORBIDDEN',
 'FORBIDDEN','reviewed_at','leave_requested','leave_reviewed',
 'REVOKE ALL ON FUNCTION','TO service_role','payrollImpact','noPayrollDeduction']){
  assert.ok(sql.includes(phrase),phrase);
 }
 for(const forbidden of [/UPDATE public\.payroll_/i,/INSERT INTO public\.payroll_/i,
  /UPDATE public\.attendance_events/i,/INSERT INTO public\.advance_repayments/i])
  assert.doesNotMatch(sql,forbidden);
});
test('HR leave UI remains a distinct submenu in responsive workspace',()=>{
 const main=read('src/client/main.js'),menu=read('src/client/functional-submenus.js'),
  ui=read('src/client/hr-leave.js');
 assert.match(main,/import \{mountHrLeave\} from '\.\/hr-leave\.js'/);
 assert.match(main,/id="hr-leave-workspace"/);
 assert.match(main,/await mountHrLeave/);
 assert.match(menu,/id:'leave',label:'การลา'/);
 assert.match(ui,/ส่งคำขอลา/);
 assert.match(ui,/อนุมัติคำขอ/);
 assert.match(ui,/ไม่คำนวณค่าจ้าง/);
 assert.match(ui,/!item\.requestedBySelf/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|innerHTML/);
});
test('leave endpoints require same QA window, station roster and credential checks',()=>{
 const gate=read('src/api/qa-hr-uat.mjs'),
  worker=read('src/worker.mjs');
 assert.match(gate,/LEAVE_ROUTES\.includes\(url\.pathname\)/);
 assert.match(gate,/OILSTATION_QA_HR_UAT_ENABLED/);
 assert.match(gate,/allowed\.length!==4/);
 assert.match(gate,/actor\?\.isQa!==true/);
 assert.match(worker,/if \(LEAVE_ROUTES\.includes\(url\.pathname\)\)/);
});
