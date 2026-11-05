import {test,expect} from '@playwright/test';
// New authorized Corporate Admin HTTP validation case 033; no accepted business writes.
const BASE='https://oilstation.goldensoft.cloud';
const COMPANY='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
const CASE='OS-QA-DRIVER-HTTP-033';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','New-case batch only');if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA secret');});
test(CASE+': dispatch-cross-origin @qa-batch',async({page})=>{
 test.setTimeout(105000);const errors=[],writes=[];
 page.on('pageerror',()=>errors.push('js_exception'));
 page.on('request',req=>{try{const u=new URL(req.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push([u.pathname,req.method()]);}catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('c01-admin');await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const a=JSON.parse(localStorage.getItem(k));if(a?.access_token)return a.access_token;}catch{}}return null;});
 expect(token).toBeTruthy();const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
 const scopes=(await me.json()).memberships;expect(scopes).toHaveLength(1);
 expect(scopes[0].scopeType).toBe('corporate_company');expect(scopes[0].role).toBe('corporate_admin');
 expect(scopes[0].corporateCompanyId).toBe(COMPANY);
 await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first()).toBeVisible();
 console.log('QA_CASE '+CASE+' CORPORATE_ADMIN_SCOPE_PASS');
 const res=await page.request.post(BASE+'/api/corporate/driver-vehicle',{headers:{...headers,origin:'https://untrusted.invalid','content-type':'application/json'},data:{companyId:COMPANY,driverUserId:'00000000-0000-4000-8000-000000000033',plate:'QA 9033'}});expect(res.status()).toBe(403);expect(await res.json()).toEqual({error:'origin_forbidden'});
 console.log('QA_CASE '+CASE+' DISPATCH_CROSS_ORIGIN_DENIED_PASS: '+res.status());
 expect(writes,'browser UI must not write').toEqual([]);expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + HTTP_NEGATIVE_PASS + NO_UI_WRITES');
});
