import {test,expect} from '@playwright/test';

// ONLY next unfinished task. No replay of Platform/Corporate/Role/HR/Report.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-CUSTOMER-CREDIT-003';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const ALIAS='s01b-owner';
const money=value=>{
 const v=/^\d{1,20}$/.test(String(value))?BigInt(value):0n;
 return (v/100n).toLocaleString('th-TH')+'.'+String(v%100n).padStart(2,'0')+' ฿';
};

test.use({headless:true,viewport:{width:390,height:844},
 trace:'off',screenshot:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true',
  'Only the protected serialized one-case GitHub workflow may run this case');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)
  throw Error('Protected QA review Secret not set');
});
test('OS-QA-ST-CUSTOMER-CREDIT-003: s01b customer credit, 3 linked accounts and refresh @qa-one-case',async({page})=>{
 test.setTimeout(110_000);
 const errors=[],mutations=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',req=>{
  try{
   const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
    !['GET','HEAD','OPTIONS'].includes(req.method()))
    mutations.push(url.pathname);
  }catch{}
 });
 const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(response?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill(ALIAS);
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const session=JSON.parse(localStorage.getItem(key));
    if(session?.access_token)return session.access_token;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status(),'station member auth').toBe(200);
 const memberships=(await me.json()).memberships;
 expect(memberships).toHaveLength(1);
 expect(memberships[0].role).toBe('station_owner');
 expect(memberships[0].scopeType).toBe('station');
 expect(memberships[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: scoped s01b station owner');

 const apiPath='/api/station/customer-overview?'+new URLSearchParams({stationId:STATION});
 const initial=await page.request.get(BASE+apiPath,{headers});
 if(initial.status()===503)console.log('QA_CASE '+CASE+' API_BLOCKED: credit overview 503');
 expect(initial.status(),'scoped customer overview API').toBe(200);
 const payload=await initial.json();
 expect(Array.isArray(payload?.accounts)).toBe(true);
 expect(payload.accounts,'exactly three existing linked QA companies').toHaveLength(3);

 const customerTile=page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first();
 await expect(customerTile).toBeVisible({timeout:14_000});
 await customerTile.click();
 await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible({timeout:14_000});
 const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');
 await expect(tab).toBeVisible({timeout:14_000});
 await tab.click();
 await expect(tab).toHaveAttribute('aria-pressed','true');
 const active=page.locator('[data-ws-screen="customers"] .os-functional-pane:visible');
 await expect.poll(()=>active.count(),{timeout:8_000,intervals:[100,200,400]}).toBe(1);
 await expect(active).toHaveAttribute('data-os-pane','credit');
 const cards=page.locator('#station-customer-credit .os-credit-account');
 await expect(cards).toHaveCount(3,{timeout:18_000});

 async function assertCreditCards(accounts){
  for(let i=0;i<accounts.length;i++){
   const card=cards.nth(i),a=accounts[i];
   await expect(card.locator('h4')).toHaveText(a.companyName);
   await expect(card.locator('.os-credit-available')).toHaveText(money(a.availableSatang));
   const breakdown=card.locator('.os-credit-detail strong');
   await expect(breakdown).toHaveCount(5);
   const values=[a.prepaidSatang,a.creditLimitSatang,a.debtSatang,a.reservedSatang,a.pendingTopupSatang];
   for(let k=0;k<5;k++)await expect(breakdown.nth(k)).toHaveText(money(values[k]));
  }
 }
 await assertCreditCards(payload.accounts);
 await expect(page.locator('#station-customer-credit .os-credit-notice'))
  .toContainText('อัปเดตบัญชี 3 รายการจากฐานข้อมูล');
 console.log('QA_CASE '+CASE+' UI_API_PASS: 3 cards + all 6 monetary values per company reconciled with GET');

 const refresh=page.locator('#station-customer-credit .os-credit-head button');
 await expect(refresh).toBeVisible();
 const refreshResponse=page.waitForResponse(res=>{
  try{
   const url=new URL(res.url());
   return url.origin===BASE && url.pathname==='/api/station/customer-overview' &&
    url.searchParams.get('stationId')===STATION;
  }catch{return false;}
 },{timeout:18_000});
 await refresh.click();
 const reply=await refreshResponse;
 expect(reply.status(),'credit refresh GET').toBe(200);
 const refreshed=await reply.json();
 expect(refreshed?.accounts).toHaveLength(3);
 await expect(page.locator('#station-customer-credit .os-credit-notice'))
  .toContainText('อัปเดตบัญชี 3 รายการจากฐานข้อมูล',{timeout:15_000});
 await assertCreditCards(refreshed.accounts);
 await expect.poll(()=>active.count(),{timeout:6_000,intervals:[100,250,400]}).toBe(1);
 expect(errors,'no browser JS failures').toEqual([]);
 expect(mutations,'no API mutations during credit read and refresh').toEqual([]);
 console.log('QA_CASE '+CASE+' REFRESH_PASS: real scoped GET and cards reconciled, no writes');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + CREDIT_API_PASS + UI_BALANCE_PASS + REFRESH_PASS + NO_WRITES');
});
