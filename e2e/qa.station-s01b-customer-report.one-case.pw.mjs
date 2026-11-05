import {test,expect} from '@playwright/test';

// Only the NEXT unfinished case. Previous Platform, Corporate, Role and HR
// cases are intentionally not invoked again.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-CUSTOMER-REPORT-002';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const USER_ALIAS='s01b-owner';
const NO_MATCH_PLATE='QA-NO-MATCH-CASE-002';

test.use({
 headless:true,
 viewport:{width:390,height:844},
 trace:'off',
 screenshot:'off',
 video:'off',
});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_ONE_CASE!==CASE,
  'Only the isolated protected one-case workflow may run this test');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)
  throw Error('Missing protected QA review password Secret');
});

test('OS-QA-ST-CUSTOMER-REPORT-002 station s01b: one Report task, correct empty history and plate filter @qa-one-case',async({page})=>{
 test.setTimeout(120_000);
 const unexpectedWrites=[];
 const pageErrors=[];
 page.on('pageerror',()=>pageErrors.push('javascript_exception'));
 page.on('request',request=>{
  try{
   const url=new URL(request.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/') &&
    !['GET','HEAD','OPTIONS'].includes(request.method()))
    unexpectedWrites.push(url.pathname);
  }catch{}
 });

 const home=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(home?.status(),'deployed preview available').toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill(USER_ALIAS);
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{
    const session=JSON.parse(localStorage.getItem(key));
    if(session?.access_token)return session.access_token;
   }catch{}
  }
  return null;
 });
 expect(token,'QA session must exist').toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status(),'QA station membership must be authoritative').toBe(200);
 const data=await me.json();
 expect(data.memberships,'one authorized synthetic role').toHaveLength(1);
 expect(data.memberships[0].scopeType).toBe('station');
 expect(data.memberships[0].role).toBe('station_owner');
 expect(data.memberships[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: station owner only');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first();
 await expect(tile).toBeVisible({timeout:12_000});
 await tile.click();
 await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible({timeout:12_000});
 const task=page.locator('[data-context-for="customers"] button[data-os-pane-key="report"]');
 await expect(task).toBeVisible({timeout:15_000});
 await task.click();
 await expect(task).toHaveAttribute('aria-pressed','true');
 const wrappers=page.locator('[data-ws-screen="customers"] .os-functional-pane');
 await expect.poll(()=>wrappers.filter({visible:true}).count(),{
  timeout:9000,intervals:[100,250,500],
  message:'only one Customer task pane visible after selecting Report',
 }).toBe(1);
 const pane=page.locator('[data-ws-screen="customers"] .os-functional-pane:visible');
 await expect(pane).toHaveAttribute('data-os-pane','report');
 await expect(page.locator('#station-fuel-report-workspace:visible .os-report-table')).toBeVisible({timeout:15_000});
 await expect(page.locator('#station-fuel-report-workspace:visible .os-report-plate')).toBeVisible();
 console.log('QA_CASE '+CASE+' UI_PASS: Home > Customers > Report; one visible pane');

 const report=await page.request.get(BASE+'/api/fuel/report?'+new URLSearchParams({stationId:STATION}),{headers});
 if(report.status()===503)console.log('QA_CASE '+CASE+' API_BLOCKED: GET /api/fuel/report returned guarded 503');
 expect(report.status(),'read-only scoped station report must be available').toBe(200);
 const body=await report.json();
 expect(Array.isArray(body?.rows),'report contains authoritative rows array').toBe(true);
 expect(body.rows,'s01b has zero completed fuel sessions in pre-run SQL baseline').toHaveLength(0);
 await expect(page.locator('#station-fuel-report-workspace .os-report-table tbody tr')).toHaveCount(1,{timeout:15_000});
 await expect(page.locator('#station-fuel-report-workspace .os-report-table tbody'))
  .toContainText('ยังไม่มีรายการเติมน้ำมันที่ตรงกับตัวกรอง',{timeout:15_000});
 await expect(page.locator('#station-fuel-report-workspace .os-report-summary'))
  .toContainText('ยอดเติมสุทธิ',{timeout:10_000});
 console.log('QA_CASE '+CASE+' API_PASS: scoped report returned zero completed sessions, UI empty state');

 const plate=page.locator('#station-fuel-report-workspace .os-report-plate');
 await plate.fill(NO_MATCH_PLATE);
 const filteredResponse=page.waitForResponse(res=>{
  try{
   const url=new URL(res.url());
   return url.origin===BASE && url.pathname==='/api/fuel/report' &&
    url.searchParams.get('stationId')===STATION &&
    url.searchParams.get('plate')===NO_MATCH_PLATE;
  }catch{return false;}
 },{timeout:15_000});
 await page.locator('#station-fuel-report-workspace .os-report-filters button').click();
 const res=await filteredResponse;
 expect(res.status(),'filtered fuel report GET').toBe(200);
 const filtered=await res.json();
 expect(filtered?.rows,'plate filter cannot manufacture fuel reports').toEqual([]);
 await expect(page.locator('#station-fuel-report-workspace .os-report-table tbody'))
  .toContainText('ยังไม่มีรายการเติมน้ำมันที่ตรงกับตัวกรอง',{timeout:15_000});
 await expect.poll(()=>wrappers.filter({visible:true}).count(),{
  timeout:6_000,intervals:[100,200,400],
 }).toBe(1);
 expect(pageErrors,'no JS crashes in report').toEqual([]);
 expect(unexpectedWrites,'no mutation requests to OilStation API').toEqual([]);
 console.log('QA_CASE '+CASE+' FILTER_PASS: query by plate, no fabricated rows, one pane, no writes');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + UI_PASS + API_PASS + FILTER_PASS + NO_WRITES');
});
