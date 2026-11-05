import {masterCase,STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='X-05-F';
masterCase({id:MASTER_UAT_ID,description:'logout-cancel-restores-keyboard-focus',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const opener=page.locator('[data-mobile-logout]:visible').first();await expect(opener).toBeVisible();await opener.focus();await opener.click();
const modal=page.locator('[data-logout-dialog]');await expect(modal).toBeVisible();
const cancel=page.locator('[data-logout-cancel]');await expect(cancel).toBeFocused();
await cancel.click();await expect(modal).not.toBeVisible();await expect(opener).toBeFocused();
await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
console.log('MASTER_CASE X-05-F DIALOG_CANCEL_KEYBOARD_FOCUS_RESTORED_PASS');
}});
