import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverWorkspaceApi} from '../../src/api/driver-workspace.mjs';
import {selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const U='11111111-1111-4111-8111-111111111111';
const C='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const BASE='https://oilstation.goldensoft.cloud';
function init(role='corporate_admin'){
 const calls=[];
 const api=createDriverWorkspaceApi({
  authenticate:async token=>token==='valid'?{id:U}:null,
  db:{
   memberships:async()=>[{active:true,role_code:role,scope_type:'corporate_company',
     corporate_company_id:C,extra_permissions:{}}],
   companyDriverRoster:async(...args)=>{calls.push(['roster',...args]);return [{userId:U,driverId:OTHER,plate:'กข 1234'}];},
   assignDriverVehicle:async d=>{calls.push(['assign',d]);return {driverId:OTHER,plate:d.plate};},
   driverCouponInbox:async id=>{calls.push(['inbox',id]);return {
    vehicles:[{plate:'กข 1234',driverName:'QA Driver'}],
    coupons:[{id:OTHER,plate:'กข 1234',qrPayload:'server-signed',status:'reserved'}],
   };},
  },
 });
 return {api,calls};
}
const GET=(url=BASE+'/api/driver/coupons',token='valid')=>new Request(url,{
 headers:{authorization:'Bearer '+token},
});
const POST=(data,origin=BASE)=>new Request(BASE+'/api/corporate/driver-vehicle',{
 method:'POST',headers:{authorization:'Bearer valid',origin,'content-type':'application/json'},
 body:JSON.stringify(data),
});
test('driver sees own registered plate and assigned signed coupons, no company balance',async()=>{
 const a=init('driver');
 const response=await a.api(GET());
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.vehicles[0].plate,'กข 1234');
 assert.equal(data.coupons[0].qrPayload,'server-signed');
 assert.deepEqual(a.calls,[['inbox',U]]);
 const screens=selectWorkspaceScreens([{scopeType:'corporate_company',role:'driver',
   corporateCompanyId:C}]).map(x=>x.key);
 assert.ok(screens.includes('driver'));
 assert.ok(!screens.includes('corporate'));
});
test('dispatcher can list drivers within own company, but cannot edit other company',async()=>{
 const a=init('corporate_admin');
 assert.equal((await a.api(GET(BASE+'/api/corporate/drivers?companyId='+C))).status,200);
 assert.equal((await a.api(POST({companyId:C,driverUserId:U,plate:'กข 1234'}))).status,200);
 assert.deepEqual(a.calls.map(c=>c[0]),['roster','assign']);
 assert.equal((await a.api(GET(BASE+'/api/corporate/drivers?companyId='+OTHER))).status,403);
 assert.equal((await a.api(POST({companyId:OTHER,driverUserId:U,plate:'กข 1234'}))).status,403);
 assert.equal(a.calls.length,2);
});
test('driver cannot assign own vehicle or fetch dispatch roster',async()=>{
 const a=init('driver');
 assert.equal((await a.api(POST({companyId:C,driverUserId:U,plate:'กข 1234'}))).status,403);
 assert.equal((await a.api(GET(BASE+'/api/corporate/drivers?companyId='+C))).status,403);
 assert.deepEqual(a.calls,[]);
});
test('issuer may inspect driver roster, but cannot edit car; accountant is denied',async()=>{
 const issuer=init('coupon_issuer');
 assert.equal((await issuer.api(GET(BASE+'/api/corporate/drivers?companyId='+C))).status,200);
 assert.equal((await issuer.api(POST({companyId:C,driverUserId:U,plate:'กข 1234'}))).status,403);
 const accountant=init('accountant');
 assert.equal((await accountant.api(GET(BASE+'/api/corporate/drivers?companyId='+C))).status,403);
});
test('malformed, unauthorized, forged origin cannot mutate driver binding',async()=>{
 const a=init();
 assert.equal((await a.api(GET(BASE+'/api/driver/coupons','bad'))).status,401);
 assert.equal((await a.api(POST({companyId:C,driverUserId:U,plate:'A'}))).status,400);
 assert.equal((await a.api(POST({companyId:C,driverUserId:U,plate:'กข 1234',balance:999}))).status,400);
 assert.equal((await a.api(POST({companyId:C,driverUserId:U,plate:'กข 1234'},'https://malicious.example'))).status,403);
 assert.deepEqual(a.calls,[]);
});
test('enterprise driver inbox and scan UI are not a LINE delivery channel',()=>{
 const screens=selectWorkspaceScreens([{scopeType:'corporate_company',role:'driver',corporateCompanyId:C}]);
 assert.equal(screens.filter(s=>s.key==='driver').length,1);
});
