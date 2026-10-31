// Pure and API-level scenario simulations. NO real Supabase or browser writes.
// Test names intentionally say "SIMULATION" so they cannot be mistaken for UAT.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createApi} from '../../src/api/router.mjs';
import {qaApprovedAlias,qaIsEnabled} from '../../src/api/qa-accounts.mjs';
import {allocateCommission,adjustPaidCommission} from '../../src/domain/commission.mjs';
import {previewCollectedCommission} from '../../src/domain/commission-preview.mjs';
import {availableToIssueSatang,assertCanIssueCoupon} from '../../src/domain/credit-availability.mjs';
import {quoteSubscription} from '../../src/domain/billing-quote.mjs';
import {nextSubscriptionWindow,reviewedRenewalPrice} from '../../src/domain/subscription-renewal.mjs';
import {calculateNetPayroll,approvedAdvanceRepayment} from '../../src/domain/payroll.mjs';
import {reviewedWorkMinutes} from '../../src/domain/approved-work-time.mjs';
import {evaluateGeofence} from '../../src/domain/geofence.mjs';
import {paidStripeEvidence} from '../../src/domain/stripe-reconciliation.mjs';

const data=JSON.parse(readFileSync(new URL('../../docs/qa/scenarios/oilstation-master-scenarios.json',import.meta.url),'utf8'));
const id='11111111-1111-4111-8111-111111111111', rid='22222222-2222-4222-8222-222222222222';
const url='https://oilstation.goldensoft.cloud';
const station=(requestId=rid)=>({organizationName:'QA Example',stationName:'QA Station One',
 brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:true},requestId});
const authReq=(route,method='GET',payload)=>new Request(url+route,{method,
 headers:{authorization:'Bearer verified',...(payload?{'content-type':'application/json'}:{})},
 ...(payload?{body:JSON.stringify(payload)}:{})});

test('SIMULATION — complete fixed scenario catalog has 59 modules and 236 distinct planned IDs',()=>{
 assert.equal(data.planId,'QA-20261031-MASTER-001');
 assert.equal(data.scenarios.length,236);
 assert.equal(new Set(data.scenarios.map(x=>x.id)).size,236);
 for(const [scope,count] of [['Platform',60],['Station',88],['Corporate',48],['CrossCutting',40]])
  assert.equal(data.scenarios.filter(x=>x.section===scope).length,count,scope);
 for(const entry of data.scenarios){
  assert.match(entry.id,/^(?:P|S|C|X)-\d\d-[HVRF]$/);
  assert.ok(entry.description.length>15,entry.id);
  assert.equal(entry.status,'NOT TESTED',entry.id);
 }
 assert.equal(data.fixedFixture.maxTestStations,4);
 assert.equal(data.fixedFixture.customersPerStation,3);
 assert.equal(data.fixedFixture.maxTestCompanies,12);
 assert.equal(data.fixedFixture.newQaUsers,99);
 assert.equal(data.fixedFixture.automaticCleanup,false);
 assert.equal(data.contract.simulationDoesNotEqualE2e,true);
});
test('SIMULATION — fixed Sales→station→company tree contains exactly 2×2×3 = 12 companies',()=>{
 const a=Object.entries(data.fixedFixture.stationBySales);
 assert.equal(a.length,2);
 assert.deepEqual(a.map(([owner])=>owner),['sales01','sales02']);
 const stations=a.flatMap(([owner,keys])=>keys.map(key=>({owner,key})));
 assert.equal(stations.length,4);
 assert.equal(new Set(stations.map(x=>x.key)).size,4);
 const companies=stations.flatMap(s=>[1,2,3].map(c=>s.key+'-C0'+c));
 assert.equal(companies.length,12);
 assert.equal(new Set(companies).size,12);
 assert.notEqual(stations[0].owner,stations[2].owner);
});
test('SIMULATION — authenticated Sales creates two own stations; retry does not duplicate; third rejected',async()=>{
 const records=new Map(), byKey=new Map();
 const api=createApi({
  authenticate:async()=>({id,isQa:true}),
  db:{
   memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}],
   salesCreateStation:async x=>{
    const key=x.actorId+':'+x.requestId;
    if(byKey.has(key))return {...byKey.get(key),replayed:true};
    if([...records.values()].filter(v=>v.salesUserId===x.actorId).length>=x.maxStations)
     throw {code:'SALES_STATION_LIMIT_REACHED'};
    const value={id:'00000000-0000-4000-8000-'+String(records.size+1).padStart(12,'0'),
     salesUserId:x.actorId,replayed:false};
    records.set(value.id,value);byKey.set(key,value);return value;
   },
   salesStations:async user=>[...records.values()].filter(x=>x.salesUserId===user)
  },
 });
 const one=await api(authReq('/api/platform/sales/create-station','POST',station()));
 assert.equal(one.status,201);
 const duplicate=await api(authReq('/api/platform/sales/create-station','POST',station()));
 assert.equal(duplicate.status,200);
 assert.equal((await duplicate.json()).station.replayed,true);
 const second=await api(authReq('/api/platform/sales/create-station','POST',
  {...station('33333333-3333-4333-8333-333333333333'),stationName:'QA Station Two'}));
 assert.equal(second.status,201);
 const third=await api(authReq('/api/platform/sales/create-station','POST',
  {...station('44444444-4444-4444-8444-444444444444'),stationName:'QA Station Three'}));
 assert.equal(third.status,409);
 assert.equal((await third.json()).error,'sales_station_limit_reached');
 const list=await api(authReq('/api/platform/sales/stations'));
 assert.equal((await list.json()).stations.length,2);
 assert.equal(records.size,2);
});
test('SIMULATION — Sales cannot call Super Admin station creation or bypass fixed ownership',async()=>{
 const calls=[];
 const api=createApi({authenticate:async()=>({id,isQa:true}),db:{
  memberships:async()=>[{active:true,scope_type:'platform',role_code:'platform_sales'}],
  createStation:async()=>{calls.push('admin');return{}},
  salesCreateStation:async()=>{calls.push('sales');return{}},
 }});
 assert.equal((await api(authReq('/api/platform/create-station','POST',station()))).status,403);
 assert.equal((await api(authReq('/api/platform/sales/create-station','POST',
  {...station(),salesUserId:'33333333-3333-4333-8333-333333333333'}))).status,400);
 assert.deepEqual(calls,[]);
});
test('SIMULATION — per-node account aliases deny cross-station/other-company role confusion',()=>{
 const allowed={
  organization:['11111111-1111-4111-8111-111111111111'],
  station:['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'],
  corporate_company:['44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555']
 };
 const check=(alias,scopeType,scopeId,roleCode)=>
  qaApprovedAlias({alias,scopeType,scopeId,roleCode},allowed);
 assert.ok(check('s01a-attendant','station',allowed.station[0],'attendant'));
 assert.ok(!check('s01a-attendant','station',allowed.station[1],'attendant'));
 assert.ok(check('c01-driver','corporate_company',allowed.corporate_company[0],'driver'));
 assert.ok(!check('c01-driver','corporate_company',allowed.corporate_company[1],'driver'));
 assert.ok(!check('sales03','platform',null,'platform_sales'));
 assert.ok(!check('sales01','platform',null,'platform_superadmin'));
});
test('SIMULATION — QA authentication fails closed unless explicit server gates all agree',()=>{
 const env={OILSTATION_DEPLOY_TARGET:'production',OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
  OILSTATION_API_ENABLED:'false',OILSTATION_QA_MODE_ENABLED:'true',
  OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001'};
 assert.ok(qaIsEnabled(env));
 for(const change of [{OILSTATION_QA_MODE_ENABLED:'false'},
  {OILSTATION_API_ENABLED:'true'},{OILSTATION_DEPLOY_TARGET:'uat'},
  {OILSTATION_QA_RUN_ID:''}])assert.ok(!qaIsEnabled({...env,...change}));
});
test('SIMULATION — commission before payment is zero, after payment follows 2 Sales effective days',()=>{
 const args={paid:true,monthlyAmountSatang:100_000n,startDate:'2026-10-01',
  endDate:'2026-11-01',assignments:[
   {salesId:'sales01',from:'2026-10-01',until:'2026-10-16'},
   {salesId:'sales02',from:'2026-10-16',until:'2026-11-01'}]};
 assert.deepEqual(allocateCommission({...args,paid:false}),[]);
 const allocations=allocateCommission(args);
 assert.equal(allocations.length,2);
 assert.deepEqual(allocations.map(x=>x.salesId),['sales01','sales02']);
 assert.equal(allocations.reduce((n,x)=>n+x.amountSatang,0n),100_000n);
 assert.throws(()=>allocateCommission({...args,assignments:[
  {salesId:'sales01',from:'2026-10-01',until:'2026-10-14'},
  {salesId:'sales02',from:'2026-10-16',until:'2026-11-01'}]}),/gap|cover/i);
 assert.throws(()=>allocateCommission({...args,assignments:[
  {salesId:'sales01',from:'2026-10-01',until:'2026-10-17'},
  {salesId:'sales02',from:'2026-10-16',until:'2026-11-01'}]}),/gap|overlap/i);
});
test('SIMULATION — commission preview never becomes actual payout or creates ledger',()=>{
 const v=previewCollectedCommission({invoicePaid:true,netRevenueSatang:'100000',
  serviceStart:'2026-10-01',serviceEnd:'2026-11-01',
  assignments:[{salesId:'sales01',from:'2026-10-01',until:'2026-11-01'}],
  rules:[{id:'qa-rule',salesId:'sales01',from:'2026-01-01',until:null,
    payoutPolicy:'monthly',mode:'percent',amount:'5'}]});
 assert.equal(v.status,'preview_only');
 assert.equal(v.payable,false);assert.equal(v.settled,false);
 assert.equal(BigInt(v.totalProposedSatang),5_000n);
 assert.throws(()=>previewCollectedCommission({invoicePaid:false}),/paid/i);
 assert.equal(adjustPaidCommission({previouslyPaidSatang:6_000n,
  revisedEntitlementSatang:5_000n}),-1_000n);
});
test('SIMULATION — VAT and PromptPay discounts are pure quote, never live settlement',()=>{
 const base={lines:[{moduleCode:'qr_coupon',quantity:1,unitPriceSatang:100_000n}],
  tax:{mode:'exclusive',rateBasisPoints:700}};
 const qr=quoteSubscription({...base,paymentMethod:'promptpay'});
 const card=quoteSubscription({...base,paymentMethod:'card'});
 assert.equal(qr.subtotalSatang,100_000n);
 assert.equal(qr.qrDiscountSatang,2_000n);
 assert.equal(card.qrDiscountSatang,0n);
 assert.ok(qr.totalSatang<card.totalSatang);
 assert.throws(()=>quoteSubscription({...base,paymentMethod:'cash'}),/invalid payment method/);
 assert.throws(()=>quoteSubscription({...base,paymentMethod:'card',
  lines:[{moduleCode:'qr_coupon',quantity:1,unitPriceSatang:-1n}]}),/invalid price/);
});
test('SIMULATION — renewal and repricing have explicit local date and advance-notice guards',()=>{
 const a=nextSubscriptionWindow({previousEnd:'2026-01-31',billingFrequency:'monthly',anchorDay:31});
 assert.equal(a.serviceEnd,'2026-02-28');
 const p=reviewedRenewalPrice({currentPriceSatang:100_000n,candidatePriceSatang:150_000n,
  candidateEffectiveDate:'2026-10-01',renewalStartDate:'2026-11-01',
  noticeSentDate:'2026-10-29',minimumNoticeDays:7});
 assert.equal(p.applied,false);
 assert.equal(p.priceSatang,100_000n);
});
test('SIMULATION — corporate credit reserves block overdraw and handle pending topup as zero',()=>{
 const wallet={prepaidSatang:50_000n,creditLimitSatang:100_000n,
  outstandingDebtSatang:70_000n,reservedSatang:30_000n};
 assert.equal(availableToIssueSatang(wallet),50_000n);
 assert.doesNotThrow(()=>assertCanIssueCoupon(wallet,50_000n));
 assert.throws(()=>assertCanIssueCoupon(wallet,50_001n),/Insufficient/);
 const pendingTopup={...wallet}; // no approved ledger credit
 assert.equal(availableToIssueSatang(pendingTopup),50_000n);
 const afterReserve={...wallet,reservedSatang:80_000n};
 assert.equal(availableToIssueSatang(afterReserve),0n);
});
test('SIMULATION — reviewed payroll excludes unverified punches and negative net pay',()=>{
 const a=reviewedWorkMinutes([{id:'in',eventType:'clock_in',reviewStatus:'accepted',
  occurredAt:'2026-10-30T08:00:00+07:00'},{id:'out',eventType:'clock_out',
  reviewStatus:'accepted',occurredAt:'2026-10-30T16:00:00+07:00'}]);
 assert.equal(a.workedMinutes,480);
 assert.throws(()=>reviewedWorkMinutes([{id:'in',eventType:'clock_in',
  reviewStatus:'pending',occurredAt:'2026-10-30T08:00:00+07:00'}]),/approved/);
 const p=calculateNetPayroll({baseSatang:100_000n,approvedOtSatang:10_000n,
  taxSatang:5_000n,socialSecuritySatang:3_000n});
 assert.equal(p.netSatang,102_000n);
 assert.throws(()=>calculateNetPayroll({baseSatang:1n,taxSatang:2n}),/negative/);
 assert.equal(approvedAdvanceRepayment({outstandingSatang:20_000n,
  plannedSatang:10_000n,allowableDeductionSatang:5_000n}),5_000n);
});
test('SIMULATION — GPS uncertain/outside never becomes implicitly approved attendance',()=>{
 const near=evaluateGeofence({latitude:13.7563,longitude:100.5018,
  stationLatitude:13.7563,stationLongitude:100.5018,accuracyMeters:10});
 assert.equal(near.status,'inside');
 const far=evaluateGeofence({latitude:13.7663,longitude:100.5118,
  stationLatitude:13.7563,stationLongitude:100.5018,accuracyMeters:10});
 assert.equal(far.status,'outside');
 const uncertain=evaluateGeofence({latitude:13.7563,longitude:100.5018,
  stationLatitude:13.7563,stationLongitude:100.5018,accuracyMeters:300});
 assert.equal(uncertain.status,'uncertain');
});
test('SIMULATION — unsigned/live Stripe events cannot prove a paid invoice',()=>{
 assert.equal(paidStripeEvidence({type:'payment_intent.failed',livemode:false}),null);
 assert.equal(paidStripeEvidence({type:'payment_intent.succeeded',livemode:true}),null);
 const good={id:'evt_demo',type:'payment_intent.succeeded',livemode:false,
  data:{object:{object:'payment_intent',id:'pi_abcdefg',livemode:false,
   metadata:{saas_invoice_id:'33333333-3333-4333-8333-333333333333',
    saas_payment_attempt_id:'44444444-4444-4444-8444-444444444444'},
   currency:'thb',status:'succeeded',amount:10000,amount_received:10000}}};
 assert.equal(paidStripeEvidence(good).invoiceId,'33333333-3333-4333-8333-333333333333');
 assert.throws(()=>paidStripeEvidence({...good,data:{object:{...good.data.object,
  amount_received:9999}}}),/invalid/);
});
test('SIMULATION — no scheduled cleanup and finance release stays opt-in',()=>{
 const worker=readFileSync(new URL('../../src/worker.mjs',import.meta.url),'utf8');
 const config=readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8');
 const wrangler=JSON.parse(config);
 assert.equal(wrangler.vars.OILSTATION_API_ENABLED,'false');
 assert.equal(wrangler.vars.OILSTATION_PREVIEW_OPERATIONS_ENABLED,'true');
 assert.ok(worker.includes("if (env.OILSTATION_API_ENABLED!=='true')"));
 assert.equal(data.contract.cleanupByOwnerOrderOnly,true);
});
