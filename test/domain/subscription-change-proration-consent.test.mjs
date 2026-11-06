import test from 'node:test';import assert from 'node:assert/strict';
import {assessSaasProrationConsent as fn} from '../../src/domain/subscription-change-proration-consent.mjs';
const base={switchMode:'immediate',creditSatang:'500',chargeSatang:'1500'};
test('immediate switch defaults to denial',()=>assert.equal(fn(base).approved,false));
test('even consented quote does not enable unimplemented mid-cycle charging',()=>{const r=fn({...base,consent:{accepted:true,quoteId:'quote-0001',policyVersion:'proration-v1'}});assert.equal(r.approved,false);assert.equal(r.reason,'immediate_switch_not_implemented');});
test('next renewal and future renewal never silently incur proration',()=>{for(const switchMode of ['next_renewal','future_renewal'])assert.equal(fn({...base,switchMode}).reason,'no_midcycle_proration_needed');});
test('bad modes, negative prices and malformed quote fail closed',()=>{assert.throws(()=>fn({...base,switchMode:'now'}));assert.throws(()=>fn({...base,chargeSatang:'-2'}));});
