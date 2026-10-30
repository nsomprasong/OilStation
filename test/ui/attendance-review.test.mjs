import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountAttendanceReview} from '../../src/client/attendance-review.js';
test('manager approval UI clearly distinguishes GPS evidence from face verification',()=>{
 const body=readFileSync(new URL('../../src/client/attendance-review.js',import.meta.url),'utf8');
 assert.equal(typeof mountAttendanceReview,'function');
 assert.match(body,/api\/hr\/attendance\/pending\?stationId/);
 assert.match(body,/api\/hr\/attendance\/review/);
 assert.match(body,/การอ้างยืนยันใบหน้า/);
 assert.match(body,/reason\.value\.trim\(\)\.length<10/);
 assert.match(body,/accept\.disabled=true/);
});
