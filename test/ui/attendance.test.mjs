import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountAttendanceWorkspace} from '../../src/client/attendance.js';
test('attendance provides all four shift punch actions and honest pending message',()=>{
 const source=readFileSync(new URL('../../src/client/attendance.js',import.meta.url),'utf8');
 for(const state of ['clock_in','clock_out','break_start','break_end']){
   assert.match(source,new RegExp('data-punch="'+state+'"'));
 }
 assert.match(source,/รออนุมัติ/);
 assert.match(source,/maximumAge:0/);
 assert.match(source,/pending=data/);
 assert.equal(typeof mountAttendanceWorkspace,'function');
});
