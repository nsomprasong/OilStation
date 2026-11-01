import {test,expect} from '@playwright/test';
import {createHmac} from 'node:crypto';
// Synthetic QA identity only; no real payroll or bank operation is permitted.
const BASE='https://oilstation.goldensoft.cloud';
async function login(page,role){
 const secret=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!secret)throw new Error('Scoped QA identity not configured');
 const pass=createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/s01a-'+role)
  .digest('base64url').slice(0,30)+'a9!';
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#qa-login-alias').fill('s01a-'+role);
 await page.locator('#qa-login-password').fill(pass);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-go="hr"]:visible').first()).toBeVisible({timeout:40000});
 await page.locator('[data-ws-go="hr"]:visible').first().click();
}
test.use({trace:'off',screenshot:'off',video:'off'});
test('QA-HR-04 independent leave UI and payroll-safe labels @qa-business-leave',
 async({browser})=>{
 test.skip(process.env.OILSTATION_QA_BUSINESS_HR_RUN!=='true','Protected QA only');
 const hr=await browser.newPage();
 const owner=await browser.newPage();
 try{
  await login(hr,'hr');
  await login(owner,'owner');
  for(const page of [hr,owner]){
   const section=page.locator('#hr-leave-workspace');
   await expect(section).toContainText('การลาและอนุมัติ');
   await expect(section.locator('form')).toHaveCount(1);
   await expect(section.locator('button[type="submit"]')).toContainText('ส่งคำขอลา');
   await expect(section).toContainText('ไม่กระทบค่าจ้างอัตโนมัติ');
   await expect(section.locator('select')).toHaveCount(2);
  }
  console.log('QA-HR LEAVE UI PASS: HR & Owner see request/review workflow, no payroll claims');
  await owner.locator('[data-ws-go="payroll"]:visible').first().click();
  await expect(owner.locator('.attendance-payroll-preview')).toContainText('ตรวจความพร้อมก่อนปิดงวด HR');
  const readiness=owner.getByRole('button',{name:'ตรวจรายการค้างก่อนปิดงวด'});
  await expect(readiness).toBeEnabled();
  await readiness.click();
  await expect(owner.locator('.attendance-payroll-preview')).toContainText(
   'ยังไม่อนุญาตให้จ่ายหรือปิดงวด',{timeout:20000});
  await expect(owner.locator('.attendance-payroll-preview')).toContainText('รอตรวจภาษีและประกันสังคม');
  console.log('QA-HR PAYROLL READINESS PASS: live scoped evidence, review blockers, no payout');
 }finally{
  await Promise.all([hr.close(),owner.close()]);
 }
});
