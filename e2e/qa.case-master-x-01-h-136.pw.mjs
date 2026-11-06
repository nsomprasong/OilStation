import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {test as pwTest} from '@playwright/test';
// OILSTATION_QA_BATCH_RUN: protected six entirely new cases.
const MASTER_UAT_ID='X-01-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-01-H authenticated UAT',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
await page.setViewportSize({width:390,height:844});await page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first().click();const pageNode=page.locator('[data-ws-screen="corporate"]:visible');await expect(pageNode).toBeVisible();const tab=page.locator('[data-context-for="corporate"] button[data-os-pane-key="report"]');await expect(tab).toBeVisible();await tab.click();const report=page.locator('#company-fuel-report');await expect(report).toBeVisible();await expect(report.locator('tbody tr')).not.toHaveCount(0);const png=await page.screenshot({fullPage:true});expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(png.length).toBeGreaterThan(4000);await pwTest.info().attach('master-x-01-h-136-corporate-real-report-mobile',{body:png,contentType:'image/png'});console.log('MASTER_CASE X-01-H AUTHENTICATED_UI_CLICKS_REAL_REPORT_AND_ATTACHED_SCREENSHOT_PASS (trace availability handled by CI)');
}});
