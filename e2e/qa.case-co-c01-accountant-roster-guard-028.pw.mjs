import {test,expect} from '@playwright/test';
// Isolated never-run case 028, guarded and serial within batch 027-030.
const BASE='https://oilstation.goldensoft.cloud',CASE='OS-QA-ROLE-BOUNDARY-028',SCOPE='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','Protected batch only');if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA secret required');});
test(CASE+': c01-accountant protected permission boundary @qa-batch',async({page})=>{
 test.setTimeout(105000);const errors=[],writes=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',req=>{try{const u=new URL(req.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push([u.pathname,req.method()]);}catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('c01-accountant');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const s=JSON.parse(localStorage.getItem(k));if(s?.access_token)return s.access_token;}catch{}}return null;});
 expect(token).toBeTruthy();const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});expect(who.status()).toBe(200);
 const m=(await who.json()).memberships;expect(m).toHaveLength(1);
 expect(m[0].role).toBe('accountant');expect(m[0].scopeType).toBe('corporate_company');expect(m[0].corporateCompanyId).toBe(SCOPE);
 console.log('QA_CASE '+CASE+' AUTH_AND_SCOPE_PASS');
 await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first()).toBeVisible();
 const res=await page.request.get(BASE+'/api/corporate/drivers?companyId='+SCOPE,{headers});
 expect(res.status()).toBe(403);expect(await res.json()).toEqual({error:'permission_denied'});
 console.log('QA_CASE '+CASE+' ACCOUNTANT_ROSTER_READ_DENIED_PASS: 403');
 expect(writes,'browser UI must not submit mutations').toEqual([]);expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_AND_SCOPE_PASS + ROLE_PERMISSION_PASS + NO_UI_WRITES');
});
