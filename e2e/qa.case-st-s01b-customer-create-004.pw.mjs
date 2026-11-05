import {test,expect} from '@playwright/test';

// Case 004 ONLY: invalid customer creation values must never reach business APIs.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},
 screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true',
  'Protected sequential one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)
  throw Error('QA review Secret unavailable');
});
test('OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004: invalid create inputs never produce write @qa-one-case',async({page})=>{
 test.setTimeout(105_000);
 const writes=[],jsErrors=[];
 page.on('pageerror',()=>jsErrors.push('javascript_exception'));
 page.on('request',req=>{
  try{
   const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
    !['GET','HEAD','OPTIONS'].includes(req.method()))
    writes.push(url.pathname);
  }catch{}
 });
 const start=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(start?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(key));
    if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const who=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(who.status()).toBe(200);
 const member=(await who.json()).memberships;
 expect(member).toHaveLength(1);
 expect(member[0].role).toBe('station_owner');
 expect(member[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: station s01b scope');

 await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
 await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
 const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="new"]');
 // Regression: previously the New Company tab disappeared when the
 // progressive form was hidden. Keep it present, enabled and operable.
 await expect(tab).toBeVisible({timeout:14_000});
 await expect(tab).toBeEnabled();
 await tab.click();
 await expect(tab).toHaveAttribute('aria-pressed','true');
 const active=page.locator('[data-ws-screen="customers"] .os-functional-pane:visible');
 await expect.poll(()=>active.count(),{timeout:8000,intervals:[100,200,400]}).toBe(1);
 await expect(active).toHaveAttribute('data-os-pane','new');
 const form=page.locator('#customer-create');
 await expect(form).toBeVisible({timeout:12_000});
 const create=page.locator('#customer-create-btn');
 await expect(create).toBeVisible();
 console.log('QA_CASE '+CASE+' FORM_PASS: only Create Company task visible');

 await create.click();
 const emptyInvalid=await form.evaluate(el=>({
  name:el.querySelector('#customer-name').validity.valueMissing,
  email:el.querySelector('#customer-email').validity.valueMissing,
 }));
 expect(emptyInvalid).toEqual({name:true,email:true});
 expect(writes).toEqual([]);
 console.log('QA_CASE '+CASE+' REQUIRED_PASS: missing company and email blocked natively');

 await page.locator('#customer-name').fill('QA VALIDATION ONLY - DO NOT CREATE');
 await page.locator('#customer-email').fill('invalid-email-without-at');
 await create.click();
 const badEmail=await page.locator('#customer-email').evaluate(el=>el.validity.typeMismatch);
 expect(badEmail).toBe(true);
 expect(writes).toEqual([]);
 console.log('QA_CASE '+CASE+' EMAIL_PASS: invalid email blocked');

 await page.locator('#customer-email').fill('qa-validation-only@qa.oilstation.invalid');
 await page.locator('#customer-tax').fill('123456789012'); // deliberately 12, not 13
 await create.click();
 await expect(page.locator('#customer-notice:visible'))
  .toContainText('เลขภาษีต้องมี 13 หลัก',{timeout:6000});
 expect(writes).toEqual([]);
 console.log('QA_CASE '+CASE+' TAX_PASS: 12-digit tax rejected without an API write');

 await page.locator('#customer-tax').fill('');
 await page.locator('#customer-due').selectOption('statement');
 await expect(page.locator('#customer-close-wrap')).toBeVisible();
 await page.locator('#customer-close').fill('0');
 await create.click();
 const rangeUnderflow=await page.locator('#customer-close').evaluate(el=>el.validity.rangeUnderflow);
 expect(rangeUnderflow,'closing day must be >=1').toBe(true);
 const dueValue=await page.locator('#customer-due').inputValue();
 expect(dueValue,'statement mode retained after invalid submission').toBe('statement');
 expect(writes,'No create-company or invitation POSTs from validation checks').toEqual([]);
 expect(jsErrors,'No uncaught JS exceptions').toEqual([]);
 console.log('QA_CASE '+CASE+' BILLING_DAY_PASS: day 0 rejected, form state preserved');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + REQUIRED_PASS + EMAIL_PASS + TAX_PASS + BILLING_DAY_PASS + NO_WRITES');
});
