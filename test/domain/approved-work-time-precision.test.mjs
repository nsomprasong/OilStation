import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedWorkMinutes} from '../../src/domain/approved-work-time.mjs';
const e=(id,eventType,occurredAt)=>({id,eventType,occurredAt,reviewStatus:'accepted'});
test('GPS seconds do not inflate work duration by rounding start or finish timestamps',()=>{
 const s=[
  e('1','clock_in','2026-10-29T08:00:59.000+07:00'),
  e('2','clock_out','2026-10-29T09:00:58.000+07:00'),
 ];
 assert.deepEqual(reviewedWorkMinutes(s),{workedMinutes:59,breakMinutes:0,shifts:1});
});
test('break seconds are subtracted before final floor, not independently rounded into pay',()=>{
 const s=[
  e('1','clock_in','2026-10-29T08:00:00+07:00'),
  e('2','break_start','2026-10-29T08:30:30+07:00'),
  e('3','break_end','2026-10-29T08:31:00+07:00'),
  e('4','clock_out','2026-10-29T09:00:30+07:00'),
 ];
 assert.deepEqual(reviewedWorkMinutes(s),{workedMinutes:60,breakMinutes:1,shifts:1});
});
test('fractional-second timestamps still reject duplicate, reversed and unreviewed punches',()=>{
 const s=[
  e('1','clock_in','2026-10-29T08:00:00.123+07:00'),
  e('2','clock_out','2026-10-29T08:00:00.456+07:00'),
 ];
 assert.equal(reviewedWorkMinutes(s).workedMinutes,0);
 assert.throws(()=>reviewedWorkMinutes([{...s[0],reviewStatus:'pending'},s[1]]),/approved/);
 assert.throws(()=>reviewedWorkMinutes([s[0],{...s[1],occurredAt:s[0].occurredAt}]),/simultaneous/);
});
