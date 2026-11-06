import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {test as pwTest} from '@playwright/test';
import {existsSync,statSync} from 'node:fs';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='X-01-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-01-V QA evidence',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
await page.setViewportSize({width:390,height:844});await page.locator('[data-ws-screen="overview"] [data-ws-go="plan"]:visible').first().click();await expect(page.locator('#station-saas-plan-workspace')).toBeVisible();const output=pwTest.info().outputPath('master-143-station-plan-proof.png');await page.screenshot({path:output,fullPage:true});expect(existsSync(output)).toBe(true);expect(statSync(output).size).toBeGreaterThan(4000);await pwTest.info().attach('master-143-station-plan-proof',{path:output,contentType:'image/png'});expect(pwTest.info().attachments.some(x=>x.name==='master-143-station-plan-proof')).toBe(true);console.log('MASTER_CASE X-01-V_UI_PASS_INCLUDES_REAL_SCREENSHOT_ATTACHMENT (missing-attachment failure gate remains distinct)');
}});
