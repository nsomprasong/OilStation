import test from 'node:test';import assert from 'node:assert/strict';
import {compareSaasSwitchSnapshot as cmp} from '../../src/domain/subscription-change-snapshot-guard.mjs';
const base={id:'one',stationId:'station',planId:'old',status:'trialing',startsAt:'2026-11-01T00:00:00Z',periodEnd:'2026-12-01T00:00:00Z'};
test('same authoritative snapshot accepted',()=>assert.equal(cmp({expected:base,actual:{...base}}).matches,true));
test('different plan, station, status or end time blocks stale switch',()=>{for(const patch of [{planId:'new'},{stationId:'foreign'},{status:'cancelled'},{periodEnd:'2027-01-01T00:00:00Z'}])assert.equal(cmp({expected:base,actual:{...base,...patch}}).matches,false);});
test('same instant in offset notation is accepted',()=>assert.equal(cmp({expected:base,actual:{...base,periodEnd:'2026-12-01T07:00:00+07:00'}}).matches,true));
test('missing or invalid source rejected',()=>{assert.throws(()=>cmp({expected:base,actual:null}));assert.throws(()=>cmp({expected:base,actual:{...base,periodEnd:'bad'}}));});
