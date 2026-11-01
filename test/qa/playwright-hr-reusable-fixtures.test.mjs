import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('HR QA accepts prior GPS pending evidence and does not assume a pristine shared project',()=>{
 const src=readFileSync(new URL('../../e2e/qa.business-hr.pw.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/pending\.json\(\)\)\.events\)\.toHaveLength\(0\)/);
 assert.match(src,/const pendingEvents=/);
 assert.match(src,/Array\.isArray\(pendingEvents\)/);
});
test('HR approval QA allocates an unused shift date each run, never re-substitutes spent Nov 15 fixture',()=>{
 const src=readFileSync(new URL('../../e2e/qa.business-approvals.pw.mjs',import.meta.url),'utf8');
 assert.match(src,/const taken=new Set\(roster\.assignments/);
 assert.match(src,/const shiftDate=testDates\.find\(d=>!taken\.has\(d\)\)/);
 assert.match(src,/post\(hr,ht,'\/api\/hr\/assign-shift'/);
 assert.match(src,/originalAssignmentId:original\.id/);
 assert.match(src,/newTemplateId:replacement\.id/);
 assert.match(src,/approvedMinutes:45/);
});
