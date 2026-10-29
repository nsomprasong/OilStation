import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedWorkMinutes} from '../../src/domain/approved-work-time.mjs';
function e(n,kind,date,status='accepted'){
 return {id:String(n),eventType:kind,occurredAt:date,reviewStatus:status};
}
test('approved overnight attendance and breaks produce deterministic minutes',()=>{
 const events=[
 e(1,'clock_in','2026-10-29T22:00:00+07:00'),
 e(2,'break_start','2026-10-29T23:30:00+07:00'),
 e(3,'break_end','2026-10-30T00:00:00+07:00'),
 e(4,'clock_out','2026-10-30T06:00:00+07:00'),
 ];
 assert.deepEqual(reviewedWorkMinutes(events),{workedMinutes:450,breakMinutes:30,shifts:1});
});
test('pending GPS, unclosed shifts and duplicate IDs never become wages',()=>{
 const events=[e(1,'clock_in','2026-10-29T08:00:00+07:00'),e(2,'clock_out','2026-10-29T16:00:00+07:00')];
 assert.throws(()=>reviewedWorkMinutes([...events.slice(0,1),{...events[1],reviewStatus:'pending'}]),/approved/);
 assert.throws(()=>reviewedWorkMinutes(events.slice(0,1)),/unclosed/);
 assert.throws(()=>reviewedWorkMinutes([...events,{...events[1]}]),/duplicate/);
});
test('overlap, invalid break, impossible shift and missing timezone reject',()=>{
 const input=[e(1,'clock_in','2026-10-29T08:00:00+07:00'),e(2,'clock_in','2026-10-29T09:00:00+07:00')];
 assert.throws(()=>reviewedWorkMinutes(input),/overlapping/);
 assert.throws(()=>reviewedWorkMinutes([e(1,'break_start','2026-10-29T08:00:00+07:00')]),/break start/);
 assert.throws(()=>reviewedWorkMinutes([e(1,'clock_in','2026-10-29T08:00:00'),e(2,'clock_out','2026-10-29T09:00:00Z')]),/offset/);
 assert.throws(()=>reviewedWorkMinutes([e(1,'clock_in','2026-10-29T08:00:00+07:00'),
 e(2,'clock_out','2026-10-30T09:00:00+07:00')]),/24 hours/);
});
