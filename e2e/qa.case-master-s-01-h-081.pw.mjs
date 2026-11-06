import {masterCase,STATION_A,STATION_B,STATION_S02A,STATION_S02B,qaLogin} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='S-01-H';
masterCase({id:MASTER_UAT_ID,description:'four-owner-stations-scoped-inventory',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const all=[
 {alias:'s01a-owner',id:STATION_A},
 {alias:'s01b-owner',id:STATION_B},
 {alias:'s02a-owner',id:STATION_S02A},
 {alias:'s02b-owner',id:STATION_S02B},
];
const observed=[];
const own=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers});
expect(own.status()).toBe(200);expect((await own.json()).fuels.length).toBeGreaterThan(0);
observed.push(STATION_A);
const browser=page.context().browser();expect(browser).toBeTruthy();
for(const fixture of all.slice(1)){
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 try{
  const p=await ctx.newPage();expect((await p.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
  const scoped=await qaLogin(p,fixture.alias,'station_owner','station',fixture.id);
  const res=await p.request.get(BASE+'/api/station-fuels?stationId='+fixture.id,{headers:scoped.headers});
  expect(res.status()).toBe(200);expect((await res.json()).fuels.length).toBeGreaterThan(0);
  const forbidden=await p.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers:scoped.headers});
  expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});
  observed.push(fixture.id);
 }finally{await ctx.close();}
}
expect(new Set(observed).size).toBe(4);
console.log('MASTER_CASE S-01-H FOUR_AUTHENTICATED_STATION_OWNER_FUEL_CONTEXTS_PASS; single-user multistation switching remains unproven');
}});
