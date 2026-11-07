import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStationProfile,profileTextLimits} from '../../src/domain/station-profile.mjs';
import {createApi} from '../../src/api/router.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const station='22222222-2222-4222-8222-222222222222';
const origin='https://oilstation.goldensoft.cloud';
const data=()=>Object.fromEntries([
 ...Object.keys(profileTextLimits).map(key=>[key,'']),
 ['vatRegistered',false],['stationName','QA Station One'],
]);
const valid=()=>({...data(),address:'กรุงเทพฯ',
 stationPhone:'021234567',stationEmail:'station@example.com',
 invoiceIssuerName:'บริษัทตัวอย่าง จำกัด',invoiceTaxId:'0123456789012',
 invoiceBranchCode:'00000',invoiceAddress:'99 ถนนทดสอบ กรุงเทพฯ',
 invoiceEmail:'invoice@example.com',vatRegistered:true,
 latitude:'13.7563',longitude:'100.5018',postalCode:'10200'});
const request=(path,method='GET',body)=>new Request(origin+path,{
 method,headers:{authorization:'Bearer valid',...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{}),
});
const setup=role=>{
 const calls=[];
 const db={
  memberships:async()=>[{active:true,scope_type:'platform',role_code:role}],
  platformReadStationProfile:async arg=>{
   calls.push(['read',arg]);return {stationId:station,stationName:'Original'};
  },
  platformUpdateStationProfile:async arg=>{
   calls.push(['write',arg]);return {stationId:station,...arg.details};
  },
 };
 return {calls,handle:createApi({authenticate:async()=>({id:actor}),db})};
};
test('platform station profiles require exact allowed details and VAT issuer readiness',()=>{
 assert.deepEqual(normalizeStationProfile(valid()),valid());
 assert.equal(normalizeStationProfile({...valid(),organizationId:station}),null);
 assert.equal(normalizeStationProfile({...valid(),brandCode:'PTT'}),null);
 assert.equal(normalizeStationProfile({...valid(),vatRegistered:true,invoiceTaxId:''}),null);
 assert.equal(normalizeStationProfile({...valid(),invoiceTaxId:'123'}),null);
 assert.equal(normalizeStationProfile({...valid(),invoiceBranchCode:'HQ'}),null);
 assert.equal(normalizeStationProfile({...valid(),postalCode:'000000'}),null);
 assert.equal(normalizeStationProfile({...valid(),latitude:'99'}),null);
 assert.equal(normalizeStationProfile({...valid(),longitude:'999'}),null);
 assert.equal(normalizeStationProfile({...valid(),stationName:'X'}),null);
 assert.equal(normalizeStationProfile({...valid(),stationEmail:'bad'}),null);
});
test('platform superadmin may GET exactly selected station and POST validated profile',async()=>{
 const {handle,calls}=setup('platform_superadmin');
 const read=await handle(request('/api/platform/station-profile?stationId='+station));
 assert.equal(read.status,200);
 assert.equal((await read.json()).profile.stationName,'Original');
 assert.deepEqual(calls.at(-1)[1],{actorId:actor,stationId:station});
 const write=await handle(request('/api/platform/station-profile/update','POST',{
  stationId:station,details:valid(),
 }));
 assert.equal(write.status,200);
 assert.equal((await write.json()).profile.stationName,'QA Station One');
 assert.equal(calls.at(-1)[1].details.invoiceBranchCode,'00000');
});
test('platform sales and other roles cannot read or edit station details',async()=>{
 for(const role of ['platform_sales','platform_support']){
  const {handle,calls}=setup(role);
  const read=await handle(request('/api/platform/station-profile?stationId='+station));
  assert.equal(read.status,403);
  const write=await handle(request('/api/platform/station-profile/update','POST',{
   stationId:station,details:valid(),
  }));
  assert.equal(write.status,403);
  assert.deepEqual(calls,[]);
 }
});
test('reject unauthorized fields, bad station ID, missing JSON body and wrong method',async()=>{
 const {handle,calls}=setup('platform_superadmin');
 const bad=await handle(request('/api/platform/station-profile/update','POST',{
  stationId:station,details:{...valid(),status:'active'},
 }));
 assert.equal(bad.status,400);
 assert.equal((await handle(request('/api/platform/station-profile?stationId=wrong'))).status,400);
 assert.equal((await handle(request('/api/platform/station-profile/update','GET'))).status,405);
 assert.equal((await handle(request('/api/platform/station-profile/update','POST'))).status,415);
 assert.equal(calls.length,0);
});
