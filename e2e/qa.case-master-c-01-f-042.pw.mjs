import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: actual guard is in the shared protected browser harness.
const MASTER_UAT_ID='C-01-F';
masterCase({id:MASTER_UAT_ID,description:'corporate-logout-private-context',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
 await expect(page.locator('[data-ws-go="corporate"]:visible').first()).toBeVisible();
await page.locator('[data-mobile-logout]:visible').first().click();
await expect(page.locator('[data-logout-dialog]')).toBeVisible();
await page.locator('[data-logout-confirm]').click();
await expect(page.locator('#qa-login-form')).toBeVisible({timeout:35000});
await page.reload({waitUntil:'domcontentloaded'});
await expect(page.locator('#qa-login-form')).toBeVisible();
await expect(page.locator('[data-workspace-shell]')).toHaveCount(0);
const own=await page.request.get(BASE+'/api/me');expect(own.status()).toBe(401);
const tokenCount=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')).length);
expect(tokenCount).toBe(0);
console.log('MASTER_CASE C-01-F LOGOUT_RELOAD_PRIVATE_CONTEXT_CLEARED_PASS');
 }});
