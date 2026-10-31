import {test,expect} from '@playwright/test';

// This is the owner's LOCAL, human-assisted Chrome test, not a CI credential runner.
// No password, bearer token, or database secret is ever printed or persisted.
// No business write routes are called (in particular no topup / QR / fueling).
const BASE='https://oilstation.goldensoft.cloud';
const OTHER_QA_COMPANY=['4e6a3fc9-217d-4543-885b-113f1f3ba4c3',
  '7f3dae09-5ff4-409c-bdf8-049086f99b7a'];
test.use({trace:'off',screenshot:'off',video:'off'});
test('Human signs into Chrome and verifies their own OilStation role safely @local-manual-qa',
 async({page})=>{
  test.skip(process.env.OILSTATION_LOCAL_MANUAL_QA!=='true',
   'Local human-driven test only. Enable explicitly in your own PowerShell.');
  test.setTimeout(10*60*1000);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#qa-login-form')).toBeVisible({timeout:30_000});
  console.log('Chrome ready. Sign in YOURSELF using the QA alias/password in the visible browser.');
  console.log('No password or access token is needed in the terminal or test source.');
  // Playwright only reads the resulting Supabase session; it never supplies
  // credentials or records input. Timeout is for the human to log in.
  let token=null;
  await expect.poll(async()=>{
   token=await page.evaluate(()=>{
    for(const key of Object.keys(localStorage)){
     if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
     try{
      const record=JSON.parse(localStorage.getItem(key));
      if(typeof record?.access_token==='string'&&record.access_token.length>100)
       return record.access_token;
     }catch{}
    }
    return null;
   }).catch(()=>null);
   return Boolean(token);
  },{timeout:6*60*1000,intervals:[1000]}).toBe(true);
  const request=async path=>page.request.get(BASE+path,{
   headers:{authorization:'Bearer '+token},
  });
  const meResponse=await request('/api/me');
  expect(meResponse.status(),'authenticated role must be accepted by server').toBe(200);
  const me=await meResponse.json();
  expect(Array.isArray(me.memberships)).toBe(true);
  expect(me.memberships.length,'at least one verified membership').toBeGreaterThan(0);
  const expected=process.env.OILSTATION_EXPECT_ROLE?.trim();
  if(expected)expect(me.memberships.map(x=>x.role)).toContain(expected);
  const memberships=me.memberships;
  console.log('Server-verified roles: '+memberships.map(m=>m.role).join(', '));
  const company=memberships.find(x=>x.role==='corporate_admin'&&x.corporateCompanyId);
  const driver=memberships.find(x=>x.role==='driver'&&x.corporateCompanyId);
  const sales=memberships.find(x=>x.role==='platform_sales'||x.role==='sales');
  if(sales){
   const stations=await request('/api/platform/sales/stations');
   expect(stations.status(),'Sales may read own stations').toBe(200);
   const body=await stations.json();
   expect(Array.isArray(body.stations)).toBe(true);
   console.log('Sales own stations checked: '+body.stations.length);
  }
  if(company){
   const accounts=await request('/api/my-accounts');
   expect(accounts.status(),'Corporate Admin account read').toBe(200);
   const own=(await accounts.json()).accounts||[];
   expect(own.some(x=>x.companyId===company.corporateCompanyId)).toBe(true);
   const roster=await request('/api/corporate/drivers?companyId='+company.corporateCompanyId);
   expect(roster.status(),'Corporate Admin own driver roster').toBe(200);
   const people=(await roster.json()).drivers||[];
   console.log('Company driver roster visible: '+people.length);
   const other=OTHER_QA_COMPANY.find(x=>x!==company.corporateCompanyId);
   const blocked=await request('/api/corporate/drivers?companyId='+other);
   expect(blocked.status(),'Different company must be denied').toBe(403);
   await page.locator('[data-ws-go="corporate"]:visible').first().click();
   await expect(page.locator('#company-driver-workspace')).toBeAttached();
  }
  if(driver){
   const inbox=await request('/api/driver/coupons');
   expect(inbox.status(),'Driver own QR inbox').toBe(200);
   const data=await inbox.json();
   expect(Array.isArray(data.vehicles)).toBe(true);
   expect(Array.isArray(data.coupons)).toBe(true);
   const forbidden=await request('/api/corporate/drivers?companyId='+driver.corporateCompanyId);
   expect(forbidden.status(),'Driver cannot read corporate staff roster').toBe(403);
   await expect(page.locator('[data-ws-go="corporate"]:visible')).toHaveCount(0);
   await page.locator('[data-ws-go="driver"]:visible').first().click();
   await expect(page.locator('#driver-workspace')).toBeVisible();
   console.log('Driver cars: '+data.vehicles.length+'; own coupons: '+data.coupons.length);
  }
  console.log('PASS: role-scoped READ-ONLY QA check. No financial mutations attempted.');
  if(process.env.OILSTATION_LOCAL_INSPECT==='true'){
   console.log('Inspect the browser now; use Resume in Playwright Inspector to finish.');
   await page.pause();
  }
});
