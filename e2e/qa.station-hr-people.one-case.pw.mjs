import {test,expect} from '@playwright/test';

// OS-QA-ST-HR-PEOPLE-001: ONE role, ONE station, ONE HR People task.
// Read-only. The live HR route intentionally denies synthetic QA actors.
const BASE='https://oilstation.goldensoft.cloud';
const ROLE='s01a-owner';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const CASE='OS-QA-ST-HR-PEOPLE-001';

test.use({
 headless:true,
 viewport:{width:390,height:844},
 trace:'off',
 screenshot:'off',
 video:'off',
});

test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_ONE_CASE!==CASE,
  'Only run from the isolated protected GitHub Actions case workflow');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)
  throw Error('Missing protected QA review password Secret');
});

test('OS-QA-ST-HR-PEOPLE-001: s01a owner, HR > People, protected roster GET @qa-one-case',async({page})=>{
 test.setTimeout(120_000);
 const unexpectedWrites=[];
 const pageErrors=[];
 page.on('pageerror',()=>pageErrors.push('browser_page_error'));
 page.on('request',request=>{
  try{
   const url=new URL(request.url());
   if(url.origin===BASE && url.pathname.startsWith('/api/') &&
    !['GET','HEAD','OPTIONS'].includes(request.method()))
    unexpectedWrites.push(url.pathname);
  }catch{}
 });

 const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(response?.status(),'live guarded preview must load').toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill(ROLE);
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
 expect(token,'authenticated QA session must exist').toBeTruthy();

 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status(),'role and station membership from backend').toBe(200);
 const identity=await who.json();
 expect(identity.memberships).toHaveLength(1);
 expect(identity.memberships[0].role).toBe('station_owner');
 expect(identity.memberships[0].scopeType).toBe('station');
 expect(identity.memberships[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: station_owner /api/me scope checked');

 const home=page.locator('[data-ws-screen="overview"] [data-ws-go="hr"]:visible').first();
 await expect(home).toBeVisible({timeout:12_000});
 await home.click();
 await expect(page.locator('[data-ws-screen="hr"]:visible')).toBeVisible({timeout:12_000});
 const people=page.locator('[data-context-for="hr"] button[data-os-pane-key="people"]');
 await expect(people).toBeVisible({timeout:12_000});
 await people.click();
 await expect(people).toHaveAttribute('aria-pressed','true');
 const wrappers=page.locator('[data-ws-screen="hr"] .os-functional-pane');
 await expect.poll(()=>wrappers.filter({visible:true}).count(),{
  timeout:8_000,intervals:[100,200,400],
  message:'Only the HR People pane may remain visible',
 }).toBe(1);
 const active=page.locator('[data-ws-screen="hr"] .os-functional-pane:visible');
 await expect(active).toHaveAttribute('data-os-pane','people');
 expect(pageErrors,'No JavaScript crash while opening People screen').toEqual([]);
 console.log('QA_CASE '+CASE+' UI_PASS: mobile Home > HR > People, one pane');

 const roster=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION,{headers});
 const body=await roster.json().catch(()=>null);
 // This is NOT the HR business functionality passing: the production HR API
 // deliberately refuses QA users; only its security boundary is verified.
 expect(roster.status(),'QA identity must not access live HR roster').toBe(403);
 expect(body?.error,'only the intentional QA-to-live-HR denial is accepted')
  .toBe('qa_identity_not_live');
 expect(unexpectedWrites,'No app business write requests').toEqual([]);
 console.log('QA_CASE '+CASE+' API_BLOCKED: GET /api/hr/roster 403 qa_identity_not_live');
 console.log('QA_CASE '+CASE+' RESULT: UI_PASS + AUTH_PASS + HR_FUNCTION_BLOCKED; no business writes');
});
