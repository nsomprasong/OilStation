import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaCouponViewApi} from '../../src/api/qa-coupon-view.mjs';

const stationIds=[
 '22222222-2222-4222-8222-222222222221',
 '22222222-2222-4222-8222-222222222222',
 '22222222-2222-4222-8222-222222222223',
 '22222222-2222-4222-8222-222222222224',
];
const companyIds=Array.from({length:12},(_,i)=>
 '33333333-3333-4333-8333-'+String(i+1).padStart(12,'0'));
const env={
 OILSTATION_DEPLOY_TARGET:'production',
 OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_MODE_ENABLED:'true',
 OILSTATION_QA_FINANCE_SIM_ENABLED:'true',
 OILSTATION_QA_RUN_ID:'QA-20261031-PLATFORM-001',
 OILSTATION_QA_STATION_IDS:stationIds.join(','),
 OILSTATION_QA_COMPANY_IDS:companyIds.join(','),
};
const coupon={id:'44444444-4444-4444-8444-444444444444',
 status:'reserved',qrPayload:'signed',stationName:'QA-S01-A'};
const target='https://oilstation.goldensoft.cloud/api/coupon-view?token=signed';
function app({enabled=true,valid=true,inside=true,stationNames=true}={}){
 const calls=[];
 const handler=createQaCouponViewApi({
  env:enabled?env:{...env,OILSTATION_QA_FINANCE_SIM_ENABLED:'false'},
  db:{
   couponView:async token=>{calls.push(['signed',token]);return valid?coupon:null;},
   qaCouponScope:async d=>{calls.push(['scope',d]);return inside;},
  },
 });
 return {handler,calls};
}
test('signed QA driver coupon requires both HMAC result and DB allowlist',async()=>{
 const a=app();
 const res=await a.handler(new Request(target));
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),coupon);
 assert.deepEqual(a.calls.map(x=>x[0]),['signed','scope']);
 assert.deepEqual(a.calls[1][1].allowed.station,stationIds);
});
test('real-station coupon and invalid signature do not expose QR or station data',async()=>{
 for(const option of [{inside:false},{valid:false}]){
  const a=app(option);
  const res=await a.handler(new Request(target));
  assert.equal(res.status,404);
  assert.equal((await res.json()).error,'invalid_coupon');
 }
});
test('finance gate OFF must not call database',async()=>{
 const a=app({enabled:false});
 assert.equal((await a.handler(new Request(target))).status,404);
 assert.deepEqual(a.calls,[]);
});
test('coupon status lookup only permits GET and forbids invalid link',async()=>{
 const a=app();
 assert.equal((await a.handler(new Request(target,{method:'POST'}))).status,405);
 assert.equal((await a.handler(new Request(target.split('?')[0]))).status,404);
 assert.deepEqual(a.calls,[]);
});
test('partial or duplicate QA company/station server allowlists fail closed',async()=>{
 const a=createQaCouponViewApi({
  env:{...env,OILSTATION_QA_STATION_IDS:[stationIds[0],stationIds[0],...stationIds.slice(2)].join(',')},
  db:{couponView:async()=>{throw new Error('must not read');}},
 });
 assert.equal((await a(new Request(target))).status,503);
});
