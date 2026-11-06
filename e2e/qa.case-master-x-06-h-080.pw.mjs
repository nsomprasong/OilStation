import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='X-06-H';
masterCase({id:MASTER_UAT_ID,description:'cross-module-readonly-pages-finish-without-js-errors',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const customers=page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first();
await expect(customers).toBeVisible();await customers.click();
await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
const credit=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');
await expect(credit).toBeVisible();await credit.click();
await expect(page.locator('#station-customer-credit .os-credit-notice')).toContainText('อัปเดตบัญชี 3 รายการจากฐานข้อมูล',{timeout:18000});
const report=page.locator('[data-context-for="customers"] button[data-os-pane-key="report"]');
await expect(report).toBeVisible();await report.click();
await expect(page.locator('#station-fuel-report-workspace .os-report-notice')).toContainText('ข้อมูลจากรายการเติมน้ำมันที่ปิดงานแล้ว',{timeout:16000});
await page.locator('[data-ws-go="overview"]:visible').first().click();
await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
await page.locator('[data-ws-screen="overview"] [data-ws-go="plan"]:visible').first().click();
await expect(page.locator('#station-saas-plan-workspace .owner-plan-list input[name="owner-plan"]').first()).toBeVisible({timeout:18000});
console.log('MASTER_CASE X-06-H THREE_OPERATIONAL_READONLY_PANES_NO_INFINITE_SPINNER_PASS');
}});
