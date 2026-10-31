import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';

// Protected production-preview QA: read-only, existing fixed accounts only.
// No DB service credentials, screenshots, videos or browser traces.
const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',org:'o01',sales:'sales01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',
  orgId:'d6f31134-2c74-41d8-8bc3-6d83bb41840b'},
 {code:'s01b',org:'o02',sales:'sales01',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',
  orgId:'948d946d-aa98-4718-b246-991313371ddb'},
 {code:'s02a',org:'o03',sales:'sales02',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',
  orgId:'db30c758-533c-463c-a226-d49f032e960a'},
 {code:'s02b',org:'o04',sales:'sales02',id:'02183a4e-47b0-4575-9f4f-74cec6553205',
  orgId:'e5cb8456-5611-421b-8265-229f6b1daa65'},
];
const organizationRoles=[
 {role:'organization_owner',suffix:'owner',allowed:['billing'],
  forbidden:['sales','stations','fuel','pump','driver','hr']},
 {role:'billing_manager',suffix:'billing',allowed:['billing'],
  forbidden:['sales','stations','fuel','pump','driver','hr']},
];
const stationRoles=[
 {role:'manager',suffix:'manager',allowed:['fuel','finance','hr','pump','reviews','attendance'],
  forbidden:['sales','stations','corporate','driver','billing']},
 {role:'cashier',suffix:'cashier',allowed:['pump','attendance'],
  forbidden:['sales','stations','finance','hr','fuel','reviews','payroll','driver']},
 {role:'attendant',suffix:'attendant',allowed:['pump','attendance'],
  forbidden:['sales','stations','finance','hr','fuel','reviews','payroll','driver']},
 {role:'pump_staff',suffix:'pump',allowed:['pump','attendance'],
  forbidden:['sales','stations','finance','hr','fuel','reviews','payroll','driver']},
 {role:'hr_manager',suffix:'hr',allowed:['hr','attendance','reviews'],
  forbidden:['sales','stations','finance','pump','fuel','customers','driver']},
 {role:'finance_manager',suffix:'finance',allowed:['finance','attendance'],
  forbidden:['sales','stations','hr','pump','fuel','customers','driver','reviews']},
];
const identities=stations.flatMap(station=>[
 ...organizationRoles.map(role=>({
  ...role,station,scope:'organization',scopeId:station.orgId,
  alias:station.org+'-'+role.suffix,field:'organizationId',
 })),
 ...stationRoles.map(role=>({
  ...role,station,scope:'station',scopeId:station.id,
  alias:station.code+'-'+role.suffix,field:'stationId',
 })),
]);
if(identities.length!==32||new Set(identities.map(x=>x.alias)).size!==32)
 throw Error('Fixed 32-role identity matrix unexpectedly changed');
function password(identity){
 const secret=process.env['OILSTATION_QA_'+identity.station.sales.toUpperCase()+'_PASSWORD'];
 if(!secret)throw Error('Missing protected Sales QA credential');
 return createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/'+identity.alias)
  .digest('base64url').slice(0,30)+'a9!';
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_REMAINING32_RUN!=='true',
  'Protected QA main-branch workflow only');
 if(!process.env.OILSTATION_QA_SALES01_PASSWORD||!process.env.OILSTATION_QA_SALES02_PASSWORD)
  throw Error('Missing protected QA credentials');
});
for(const identity of identities){
 test('R32 '+identity.alias+' verifies '+identity.role+' scope and menus @qa-remaining32',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const page=await context.newPage();
   const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
   expect(response?.status()).toBe(200);
   await expect(page.locator('#qa-login-form')).toBeVisible({timeout:40000});
   await page.locator('#qa-login-alias').fill(identity.alias);
   await page.locator('#qa-login-password').fill(password(identity));
   await page.locator('#qa-login-form button[type=submit]').click();
   await expect(page.locator('[data-ws-go="overview"]:visible').first()).toBeVisible({timeout:35000});
   const token=await page.evaluate(()=>{
    for(const key of Object.keys(localStorage)){
     if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
     try{
      const session=JSON.parse(localStorage.getItem(key));
      if(typeof session?.access_token==='string')return session.access_token;
     }catch{}
    }
    return null;
   });
   expect(token,'Supabase login session').toBeTruthy();
   const headers={authorization:'Bearer '+token};
   const me=await page.request.get(BASE+'/api/me',{headers});
   expect(me.status(),identity.alias+' /api/me').toBe(200);
   const data=await me.json();
   expect(data.memberships,identity.alias+' must have only 1 active QA scope').toHaveLength(1);
   expect(data.memberships[0].role).toBe(identity.role);
   expect(data.memberships[0].scopeType).toBe(identity.scope);
   expect(data.memberships[0][identity.field]).toBe(identity.scopeId);

   const forbidden=await page.request.get(BASE+'/api/platform/sales/stations',{headers});
   expect(forbidden.status(),'non-Sales must not read Sales-owned stations').toBe(403);
   for(const key of identity.forbidden){
    await expect(page.locator('[data-ws-go="'+key+'"]')).toHaveCount(0);
   }
   for(const key of identity.allowed){
    const nav=page.locator('[data-ws-go="'+key+'"]:visible').first();
    await expect(nav,identity.alias+' expected menu '+key).toBeVisible();
    await nav.click();
    await expect(page.locator('[data-ws-screen="'+key+'"]:visible'),
      identity.alias+' functional page '+key).toBeVisible();
    // Only Home lists all top-level authorized modules. Return there before
    // testing the next module; the contextual submenu is NOT a main menu.
    await page.locator('[data-ws-go="overview"]:visible').first().click();
    await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
   }
   console.log('PASS '+identity.alias+' role='+identity.role+' scope='+identity.scope);
  }finally{await context.close();}
 });
}
