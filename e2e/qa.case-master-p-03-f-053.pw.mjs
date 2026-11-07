import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='P-03-F';
masterCase({id:MASTER_UAT_ID,description:'sales-reopen-create-draft-without-saving',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
const add=page.locator('[data-ws-screen="stations"] > .ws-screen-head .os-station-create-cta');
await expect(add).toBeVisible({timeout:16000});await add.click();
const form=page.locator('#new-station-form');await expect(form).toBeVisible();
await expect(form.locator('#module-qr')).toBeChecked();await expect(form.locator('#module-hr')).not.toBeChecked();
await expect(form).toContainText('ยังไม่เปิดขายจนกว่าจะตั้งราคาและเปิดใช้งาน');
await form.locator('#org-name').fill('UNSAVED QA DRAFT');
await page.locator('[data-ws-go="overview"]:visible').first().click();
await page.locator('[data-ws-screen="overview"] [data-ws-go="stations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="stations"]:visible')).toBeVisible();
await expect(page.locator('#new-station-form input[type="number"]')).toHaveCount(0);
console.log('MASTER_CASE P-03-F STAGED_FUEL_UNPRICED_FORM_VIEW_PASS (draft reopen never submitted)');
}});
