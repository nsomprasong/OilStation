import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by shared helper.
const MASTER_UAT_ID='X-05-H';
masterCase({id:MASTER_UAT_ID,description:'thai-report-label-and-keyboard-search',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
const reportTab=page.locator('[data-context-for="customers"] button[data-os-pane-key="report"]');
await expect(reportTab).toBeVisible();await reportTab.click();
const label=page.locator('#station-fuel-report-workspace label').filter({hasText:'ทะเบียนรถ'});
const input=label.locator('input.os-report-plate');await expect(input).toBeVisible();
await expect(input).toHaveAttribute('placeholder',/ทะเบียนรถ/);
await input.focus();await expect(input).toBeFocused();await input.fill('QA-ไม่มีจริง-078');
const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/fuel/report'&&new URL(r.url()).searchParams.get('plate')==='QA-ไม่มีจริง-078',{timeout:16000});
await input.press('Enter');
const res=await response;expect(res.status()).toBe(200);expect((await res.json()).rows).toEqual([]);
await expect(page.locator('#station-fuel-report-workspace .os-report-table tbody')).toContainText('ยังไม่มีรายการเติมน้ำมันที่ตรงกับตัวกรอง');
await expect(page.locator('#station-fuel-report-workspace .os-report-notice[role="status"]')).toContainText('ข้อมูลจากรายการเติมน้ำมันที่ปิดงานแล้ว');
console.log('MASTER_CASE X-05-H THAI_LABEL_KEYBOARD_ENTER_SEARCH_AND_EMPTY_STATE_PASS');
}});
