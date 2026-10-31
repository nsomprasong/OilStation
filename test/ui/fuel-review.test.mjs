import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountFuelReviewInbox} from '../../src/client/fuel-review.js';
test('manager review requires original private image and explicit values',()=>{
 const source=readFileSync(new URL('../../src/client/fuel-review.js',import.meta.url),'utf8');
 assert.equal(typeof mountFuelReviewInbox,'function');
 assert.match(source,/api\/evidence\/fuel\/reviews\?stationId/);
 assert.match(source,/api\/evidence\/fuel\/photo\?evidenceId/);
 assert.match(source,/img\.onload/);
 assert.match(source,/approve\.disabled=true/);
 assert.match(source,/URL\.revokeObjectURL/);
 assert.doesNotMatch(source,/OCR แนะนำ/);
 assert.match(source,/bahtToSatang\(amount\.value\.trim\(\)\)/);
});
