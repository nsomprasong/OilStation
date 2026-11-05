import {test,expect} from '@playwright/test';
// New case 035 independently validates rejected dispatcher input on protected Preview.
const BASE='https://oilstation.goldensoft.cloud',COMPANY='4e6a3fc9-217d-4543-885b-113f1f3ba4c3',CASE='OS-QA-DRIVER-INPUT-035';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{test.skip(process.env.OILSTATION_QA_BATCH_RUN!=='true','Only protected new-case batch');if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Protected QA secret missing');});
test(CASE+': short-plate-rejection @qa-batch',async({page})=>{
 test.setTimeout(105000);const errors=[],writes=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',req=>{try{const u=new URL(req.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push([u.pathname,req.method()]);}catch{}});
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('c01-admin');await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const s=JSON.parse(localStorage.getItem(k));if(s?.access_token)return s.access_token;}catch{}}return null;});
 expect(token).toBeTruthy();const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
 const m=(await me.json()).memberships;expect(m).toHaveLength(1);expect(m[0].role).toBe('corporate_admin');expect(m[0].scopeType).toBe('corporate_company');expect(m[0].corporateCompanyId).toBe(COMPANY);
 await expect(page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first()).toBeVisible();
 console.log('QA_CASE '+CASE+' CORPORATE_ADMIN_AUTH_PASS');
 const res=await page.request.post(BASE+'/api/corporate/driver-vehicle',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{companyId:COMPANY,driverUserId:'00000000-0000-4000-8000-000000000035',plate:'ABC'}});expect(res.status()).toBe(400);expect(await res.json()).toEqual({error:'invalid_assignment'});
 console.log('QA_CASE '+CASE+' SHORT_PLATE_REJECTION_PASS: '+res.status());
 expect(writes,'browser must not send any UI writes').toEqual([]);expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + INVALID_INPUT_REJECTED + NO_UI_WRITES');
});
