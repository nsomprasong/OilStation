import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='P-13-V';
masterCase({id:MASTER_UAT_ID,description:'zero-commission-not-shown-as-paid',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
const res=await page.request.get(BASE+'/api/platform/sales/workspace',{headers});
expect(res.status()).toBe(200);const data=(await res.json()).result;
expect(data.commissions).toEqual([]);expect(data.collectedCustomers).toEqual([]);
await page.locator('[data-ws-screen="overview"] [data-ws-go="sales"]:visible').first().click();
await expect(page.locator('[data-ws-screen="sales"]:visible')).toBeVisible();
const tab=page.locator('[data-context-for="sales"] button[data-os-pane-key="commission"]');
await expect(tab).toBeVisible();await tab.click();
const pane=page.locator('[data-ws-screen="sales"] .os-functional-pane[data-os-pane="commission"]:visible');
await expect(pane).toBeVisible();
await expect(pane).toContainText('ยังไม่มีรายการค่าคอมมิชชั่นที่บันทึกไว้');
await expect(pane).toContainText('ไม่ใช่ยอดอนุมัติจ่าย');
console.log('MASTER_CASE P-13-V EMPTY_COMMISSION_NOT_MISLABELED_AS_PAID_PASS');
}});
