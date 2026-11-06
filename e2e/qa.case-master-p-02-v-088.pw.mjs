import {masterCase,qaLogin} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-02-V';
masterCase({id:MASTER_UAT_ID,description:'third-QA-station-hard-limit-atomic',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const browser=page.context().browser();expect(browser).toBeTruthy();
const candidates=[
 {p:page,headers,alias:'sales01',req:'00000000-0000-4000-8000-000000000088'},
 {alias:'sales02',req:'00000000-0000-4000-8000-000000000089'},
];
const ctx=await browser.newContext({viewport:{width:390,height:844}});
try{
 const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});
 const second=await qaLogin(p,'sales02','platform_sales','platform');
 candidates[1].p=p;candidates[1].headers=second.headers;
 for(const c of candidates){
  const url=BASE+'/api/platform/sales/stations';
  const initial=await c.p.request.get(url,{headers:c.headers});expect(initial.status()).toBe(200);
  const before=(await initial.json()).stations;expect(before).toHaveLength(2);
  const post=await c.p.request.post(BASE+'/api/platform/sales/create-station',{headers:{...c.headers,origin:BASE,'content-type':'application/json'},data:{
    organizationName:'QA BLOCKED THIRD '+c.alias,stationName:'QA NEVER ALLOW THIRD',
    brandCode:'PTT',modules:{qrCoupon:true,hrPayroll:false},requestId:c.req
  }});
  expect(post.status(),'SQL must reject well-formed third station before inserts').toBe(409);
  expect(await post.json()).toEqual({error:'sales_station_limit_reached'});
  const later=await c.p.request.get(url,{headers:c.headers});expect(later.status()).toBe(200);
  expect((await later.json()).stations).toEqual(before);
 }
}finally{await ctx.close();}
console.log('MASTER_CASE P-02-V BOTH_SALES_THIRD_CREATE_DENIED_409_AND_STATIONS_UNCHANGED_PASS');
}});
