import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='S-22-F';
masterCase({id:MASTER_UAT_ID,description:'sales-unsaved-station-draft-survives-home-navigation',alias:'sales02',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
const add=page.locator('[data-ws-screen="stations"] > .ws-screen-head .os-station-create-cta');await expect(add).toBeVisible();await add.click();
const form=page.locator('#new-station-form');await expect(form).toBeVisible();
await expect(form).toHaveAttribute('data-os-station-submit-ready','true',{timeout:18000});
const org='QA UNSAVED DRAFT 097';const station='QA NOT CREATED 097';
await form.locator('#org-name').fill(org);await form.locator('#station-name').fill(station);
await form.locator('#brand-select').selectOption('PTT');await form.locator('#module-hr').check();
await page.locator('[data-ws-go="overview"]:visible').first().click();
await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
expect(await form.locator('#org-name').inputValue()).toBe(org);
expect(await form.locator('#station-name').inputValue()).toBe(station);
expect(await form.locator('#brand-select').inputValue()).toBe('PTT');
await expect(form.locator('#module-hr')).toBeChecked();
const own=await page.request.get(BASE+'/api/platform/sales/stations',{headers});expect(own.status()).toBe(200);
expect((await own.json()).stations).toHaveLength(2);
console.log('MASTER_CASE S-22-F UNSAVED_STATION_DRAFT_PERSISTS_AFTER_HOME_RETURN_NO_NEW_STATION_PASS');
}});
