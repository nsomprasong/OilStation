import {masterCase} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='P-09-V';
masterCase({id:MASTER_UAT_ID,description:'third-sales-alias-rejection',
 check:async({page,auth,headers,expect,BASE})=>{
 await expect(page.locator('#qa-login-form')).toBeVisible();
await page.locator('#qa-login-alias').fill('sales03');
await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
await page.locator('#qa-login-form button[type="submit"]').click();
await expect(page.locator('#notice')).toContainText('ชื่อผู้ใช้หรือรหัสผ่านทดสอบไม่ถูกต้อง',{timeout:15000});
await expect(page.locator('#qa-login-form')).toBeVisible();
const anon=await page.request.get(BASE+'/api/me');expect(anon.status()).toBe(401);
console.log('MASTER_CASE P-09-V SALES03_LOGIN_REJECTED_PASS (no account creation)');
 }});
