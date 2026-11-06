import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='C-12-H';
masterCase({id:MASTER_UAT_ID,description:'driver-mobile-vehicle-and-coupon-real-inbox',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
await page.setViewportSize({width:390,height:844});
const res=await page.request.get(BASE+'/api/driver/coupons',{headers});expect(res.status()).toBe(200);
const inbox=await res.json();expect(Array.isArray(inbox.vehicles)).toBe(true);expect(Array.isArray(inbox.coupons)).toBe(true);
await page.locator('[data-ws-screen="overview"] [data-ws-go="driver"]:visible').first().click();
await expect(page.locator('[data-ws-screen="driver"]:visible')).toBeVisible();
const target=page.locator('#driver-workspace');await expect(target).toBeVisible();
await expect(target.locator('[role="status"]')).toContainText('แสดงเฉพาะรถและคูปองที่ผูกกับบัญชีคนขับนี้',{timeout:20000});
for(const car of inbox.vehicles)await expect(target).toContainText('ทะเบียน '+car.plate);
const bodyCards=target.locator(':scope > .module-list').last().locator('article');
await expect(bodyCards).toHaveCount(inbox.coupons.length);
if(!inbox.coupons.length)await expect(target).toContainText('ยังไม่มี QR ที่บริษัทออกให้');
for(const item of inbox.coupons){
 if(!item.qrPayload||!['reserved','verified'].includes(item.status)||Date.parse(item.expiresAt)<=Date.now())
  expect(await bodyCards.filter({hasText:item.stationName}).locator('canvas').count()).toBe(0);
}
const button=target.locator('button').filter({hasText:'รีเฟรชคูปอง'});await expect(button).toBeEnabled();
await button.click();await expect(target.locator('[role="status"]')).toContainText('แสดงเฉพาะรถและคูปองที่ผูกกับบัญชีคนขับนี้');
console.log('MASTER_CASE C-12-H DRIVER_MOBILE_REAL_ASSIGNED_VEHICLE_COUPON_LIST_AND_REFRESH_PASS');
}});
