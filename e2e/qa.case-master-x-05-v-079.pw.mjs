import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='X-05-V';
masterCase({id:MASTER_UAT_ID,description:'mobile-no-global-overflow-and-empty-report',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
for(const width of [320,360,390]){
 await page.setViewportSize({width,height:720});
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
 const geometry=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 expect(geometry.scroll,'no global horizontal scrollbar on Home at '+width).toBeLessThanOrEqual(geometry.client+3);
}
await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="report"]');
await expect(tab).toBeVisible();await tab.click();
await expect(page.locator('#station-fuel-report-workspace .os-report-table tbody')).toContainText('ยังไม่มีรายการเติมน้ำมันที่ตรงกับตัวกรอง');
const reportGeo=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
expect(reportGeo.scroll,'no global horizontal overflow in report').toBeLessThanOrEqual(reportGeo.client+3);
console.log('MASTER_CASE X-05-V THREE_NARROW_WIDTHS_NO_GLOBAL_OVERFLOW_EMPTY_REPORT_PASS');
}});
