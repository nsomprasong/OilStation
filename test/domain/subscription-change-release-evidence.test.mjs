import test from 'node:test';import assert from 'node:assert/strict';
import {SAAS_SWITCH_GATES,assessSaasSwitchReleaseEvidence as fn} from '../../src/domain/subscription-change-release-evidence.mjs';
const evidence=()=>Object.fromEntries(SAAS_SWITCH_GATES.map(name=>[name,{outcome:'PASS',runUrl:'https://github.com/nsomprasong/OilStation/actions/runs/42178790812',commitSha:'a'.repeat(40)}]));
test('no evidence means blocked for all required gates',()=>{const r=fn({evidence:{}});assert.equal(r.readyForManualReleaseReview,false);assert.equal(r.missing.length,SAAS_SWITCH_GATES.length);});
test('partial or guessed pass is not accepted',()=>{const e=evidence();e.payment_recovery={outcome:'PASS'};assert.ok(fn({evidence:e}).missing.includes('payment_recovery'));});
test('full well-shaped evidence only allows manual review, never auto release',()=>{const r=fn({evidence:evidence()});assert.equal(r.readyForManualReleaseReview,true);assert.equal(r.decision,'MANUAL_REVIEW_REQUIRED_NOT_AUTO_RELEASE');assert.ok(Object.isFrozen(r.missing));});
test('invalid evidence types fail closed',()=>{assert.throws(()=>fn({evidence:[]}));assert.throws(()=>fn({evidence:null}));});
