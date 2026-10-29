import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformBillingApi} from '../../src/api/platform-billing.mjs';
const U='11111111-1111-4111-8111-111111111111',ORG='22222222-2222-4222-8222-222222222222',ST='33333333-3333-4333-8333-333333333333';
const base='https://oilstation.goldensoft.cloud';
const req=(route,data,headers={})=>new Request(base+route,{method:'POST',headers:{
  'content-type':'application/json',authorization:'Bearer good',...headers},body:JSON.stringify(data)});
const routes=['flat-plan','tax','group','subscription','draft','issue'];
const items=[
 {code:'basic_2026',name:'Basic OilStation',frequency:'monthly',
 couponPriceSatang:'150000',hrPriceSatang:'50000',effectiveOn:'2026-11-01'},
 {vatMode:'exclusive',rateBasisPoints:700,effectiveOn:'2026-11-01'},
 {organizationId:ORG,name:'Main billing group',stationIds:[ST]},
 {stationId:ST,planId:ORG,startsAt:'2026-11-01T00:00:00Z',
 periodEnd:'2026-12-01T00:00:00Z'},
 {billingGroupId:ORG,paymentMethod:'promptpay',periodStart:'2026-11-01',periodEnd:'2026-12-01'},
 {invoiceId:ORG},
];
function mock(deny=false){
 const calls=[];const db=Object.fromEntries([
 ['platformSaasDefinePlan','flat-plan'],['platformSaasTaxPolicy','tax'],
 ['platformSaasGroup','group'],['platformSaasSubscription','subscription'],
 ['platformSaasDraftInvoice','draft'],['platformSaasIssueInvoice','issue'],
 ['platformSaasBillingOverview','overview']].map(([method,label])=>[method,async d=>{
  calls.push([label,d]);if(deny)throw {code:'FORBIDDEN'};return {ok:true};
 }]));
 return {calls,handler:createPlatformBillingApi({authenticate:async t=>t==='good'?{id:U}:null,db})};
}
test('approved platform billing routes use authenticated identity and validated scope',async()=>{
 const a=mock();
 for(let i=0;i<routes.length;i++){
  const response=await a.handler(req('/api/platform/billing/'+routes[i],items[i]));
  assert.equal(response.status,200);
 }
 assert.deepEqual(a.calls.map(x=>x[0]),routes);
 assert.ok(a.calls.every(x=>x[1].actorId===U));
});
test('cross-origin, arbitrary amounts, duplicate station and malformed dates reject before RPC',async()=>{
 const a=mock();
 const cases=[
 ['/api/platform/billing/draft',{...items[4],amountSatang:'1'}],
 ['/api/platform/billing/group',{...items[2],stationIds:[ST,ST]}],
 ['/api/platform/billing/flat-plan',{...items[0],frequency:'annual'}],
 ['/api/platform/billing/tax',{...items[1],rateBasisPoints:-1}],
 ['/api/platform/billing/draft',{...items[4],periodEnd:'2026-02-30'}],
 ];
 for(const [route,body] of cases)assert.equal((await a.handler(req(route,body))).status,400);
 assert.equal((await a.handler(req('/api/platform/billing/issue',items[5],
  {origin:'https://malicious.invalid'}))).status,403);
 assert.equal((await a.handler(req('/api/platform/billing/issue',items[5],
  {authorization:'Bearer wrong'}))).status,401);
 assert.equal(a.calls.length,0);
});
test('platform billing overview requires exact sign-in and DB role check',async()=>{
 const a=mock(true);
 const r=await a.handler(new Request(base+'/api/platform/billing/overview',{
   headers:{authorization:'Bearer good'}}));
 assert.equal(r.status,403);
 assert.deepEqual(a.calls[0][0],'overview');
 assert.equal((await a.handler(new Request(base+'/api/platform/billing/overview'))).status,401);
});
