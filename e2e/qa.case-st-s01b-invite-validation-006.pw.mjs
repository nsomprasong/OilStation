import {test,expect} from '@playwright/test';

// OS-QA-ST-INVITE-VALIDATION-006: ONE station owner, invitation drawer,
// native invalid email guards, allowed roles and close; NO invite POST.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-INVITE-VALIDATION-006';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA review Secret unavailable');
});
test(CASE+': mobile station invite drawer, invalid values, no writes @qa-one-case',async({page})=>{
 test.setTimeout(105_000);
 const writes=[],errors=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',req=>{
  try{const url=new URL(req.url());if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
   !['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(url.pathname);}catch{}
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
   try{const s=JSON.parse(localStorage.getItem(key));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const who=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(who.status()).toBe(200);
 const memberships=(await who.json()).memberships;
 expect(memberships).toHaveLength(1);
 expect(memberships[0].role).toBe('station_owner');
 expect(memberships[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: station owner verified');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first();
 await expect(tile).toBeVisible({timeout:14_000});
 await tile.click();
 const screen=page.locator('[data-ws-screen="invitations"]:visible');
 await expect(screen).toBeVisible({timeout:12_000});
 const add=screen.locator('button.os-member-create');
 await expect(add).toHaveCount(1);
 await expect(add).toBeVisible();
 await add.click();
 const dialog=screen.locator('dialog.os-member-drawer');
 await expect(dialog).toBeVisible();
 const inviteTab=dialog.locator('#os-member-tab-invite');
 await expect(inviteTab).toHaveAttribute('aria-selected','true');
 const panel=dialog.locator('#os-member-panel-invite');
 await expect(panel).toBeVisible();
 const form=panel.locator('form.invite-form');
 await expect(form).toBeVisible();
 const email=form.locator('input[type="email"]');
 const roles=form.locator('select[aria-label="สิทธิ์ที่จะเชิญ"]');
 const submit=form.locator('button[type="submit"]');
 await expect(email).toHaveCount(1);
 await expect(roles).toHaveCount(1);
 await expect(submit).toHaveCount(1);
 const allowed=await roles.locator('option').evaluateAll(options=>options.map(o=>o.value));
 expect(allowed).toEqual(['manager','cashier','attendant','pump_staff','hr_manager','finance_manager']);
 expect(allowed).not.toContain('station_owner');
 console.log('QA_CASE '+CASE+' DRAWER_AND_ROLES_PASS: one invitation tab and authorized staff roles');

 await submit.click();
 expect(await email.evaluate(el=>el.validity.valueMissing)).toBe(true);
 expect(writes,'missing recipient cannot create invitation').toEqual([]);
 console.log('QA_CASE '+CASE+' REQUIRED_PASS: blank email blocked');
 await email.fill('qa-invalid-address-without-at');
 await submit.click();
 expect(await email.evaluate(el=>el.validity.typeMismatch)).toBe(true);
 expect(writes,'invalid email cannot create invitation').toEqual([]);
 console.log('QA_CASE '+CASE+' EMAIL_PASS: malformed recipient blocked');

 await dialog.locator('button[aria-label="ปิดหน้าต่างเพิ่มสมาชิก"]').click();
 await expect(dialog).not.toBeVisible();
 await expect(add).toBeVisible();
 expect(writes,'No invitation/QA-account write during validation').toEqual([]);
 expect(errors,'No uncaught Javascript exception').toEqual([]);
 console.log('QA_CASE '+CASE+' CLOSE_PASS: cancel preserves directory without writes');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + DRAWER_AND_ROLES_PASS + REQUIRED_PASS + EMAIL_PASS + CLOSE_PASS + NO_WRITES');
});
