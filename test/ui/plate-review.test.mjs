import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountPlateReviewInbox} from '../../src/client/plate-review.js';
test('manager photo review is explicitly gated and proof is private',()=>{
 const ui=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 const code=readFileSync(new URL('../../src/client/plate-review.js',import.meta.url),'utf8');
 assert.equal(typeof mountPlateReviewInbox,'function');
 assert.match(ui,/if\(canReview\)mountPlateReviewInbox/);
 assert.match(code,/api\/evidence\/plate\/photo\?photoId/);
 assert.match(code,/photo\.onload/);
 assert.match(code,/URL\.revokeObjectURL/);
 assert.match(code,/approve\.disabled=true/);
});
