import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='P-13-F';
masterCase({id:MASTER_UAT_ID,description:'sales-commission-refresh-reconciles-to-server',alias:'sales02',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const endpoint=BASE+'/api/platform/sales/workspace';
const before=await page.request.get(endpoint,{headers});expect(before.status()).toBe(200);
const original=(await before.json()).result;expect(original.isAdmin).toBe(false);expect(original.assignments).toHaveLength(2);
await page.locator('[data-ws-screen="overview"] [data-ws-go="sales"]:visible').first().click();
await expect(page.locator('[data-ws-screen="sales"]:visible')).toBeVisible();
const tab=page.locator('[data-context-for="sales"] button[data-os-pane-key="commission"]');
await expect(tab).toBeVisible();await tab.click();
const header=page.locator('[data-ws-screen="sales"] .os-sales-head button');
await expect(header).toBeVisible();
const refresh=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='GET',{timeout:18000});
await header.click();const resp=await refresh;expect(resp.status()).toBe(200);
const later=(await resp.json()).result;
expect(later.commissions).toEqual(original.commissions);
expect(later.collectedCustomers).toEqual(original.collectedCustomers);
expect(later.assignments).toEqual(original.assignments);
await expect(page.locator('[data-ws-screen="sales"] .os-sales-status').first()).toContainText('แสดงเฉพาะข้อมูลที่คุณมีสิทธิ์ดู');
console.log('MASTER_CASE P-13-F REFRESH_SERVER_LEDGER_SAME_NO_FAKE_PAID_STATUS_PASS');
}});
