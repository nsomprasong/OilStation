import test from 'node:test';import assert from 'node:assert/strict';
import {assessSaasSwitchNotice as fn} from '../../src/domain/subscription-change-notice-window.mjs';
const a={effectiveAtUtc:'2026-12-01T00:00:00Z',noticeAcknowledgedAtUtc:'2026-11-29T00:00:00Z',minNoticeHours:24};
test('acknowledged 48 hours ahead meets notice precondition only',()=>{const r=fn(a);assert.equal(r.ready,true);assert.match(r.reason,/not_activation/);});
test('missing and late acknowledgment denied',()=>{assert.equal(fn({...a,noticeAcknowledgedAtUtc:null}).ready,false);assert.equal(fn({...a,noticeAcknowledgedAtUtc:'2026-11-30T23:00:00Z'}).ready,false);});
test('acknowledgment after effective instant denied',()=>assert.equal(fn({...a,noticeAcknowledgedAtUtc:'2026-12-02T00:00:00Z'}).reason,'acknowledgment_after_switch'));
test('invalid notice requirement and dates rejected',()=>{assert.throws(()=>fn({...a,minNoticeHours:-1}));assert.throws(()=>fn({...a,effectiveAtUtc:'tomorrow'}));});
