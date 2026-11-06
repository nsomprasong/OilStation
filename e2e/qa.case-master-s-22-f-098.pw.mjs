import {masterCase} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='S-22-F';
masterCase({id:MASTER_UAT_ID,description:'unsaved-station-form-reload-recovery',alias:'sales02',role:'platform_sales',scopeType:'platform',
check:async({page,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
const add=page.locator('[data-ws-screen="stations"] > .os-add-fab');await expect(add).toBeVisible();await add.click();
const form=page.locator('#new-station-form');await expect(form).toBeVisible();
await expect(form).toHaveAttribute('data-os-station-submit-ready','true',{timeout:16000});
await form.locator('#org-name').fill('QA UNSAVED DRAFT 098');
await form.locator('#station-name').fill('QA NEVER CREATED');
await form.locator('#brand-select').selectOption('PTT');
await form.locator('#module-hr').check();
expect(await form.locator('#org-name').inputValue()).toBe('QA UNSAVED DRAFT 098');
await page.reload({waitUntil:'domcontentloaded'});
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible({timeout:35000});
await page.locator('[data-ws-screen="stations"] > .os-add-fab').click();
const restored=page.locator('#new-station-form');await expect(restored).toBeVisible();
await expect(restored.locator('#org-name')).toHaveValue('QA UNSAVED DRAFT 098');
await expect(restored.locator('#station-name')).toHaveValue('QA NEVER CREATED');
await expect(restored.locator('#module-hr')).toBeChecked();
console.log('MASTER_CASE S-22-F UNSAVED_STATION_DRAFT_SURVIVES_RELOAD_NO_CREATE_PASS');
}});
