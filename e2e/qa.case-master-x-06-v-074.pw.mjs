import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='X-06-V';
masterCase({id:MASTER_UAT_ID,description:'credit-network-outage-visible-retry-recovers',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const api=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});
expect(api.status()).toBe(200);expect((await api.json()).accounts).toHaveLength(3);
await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
const creditTab=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');
await expect(creditTab).toBeVisible();await creditTab.click();
const notice=page.locator('#station-customer-credit .os-credit-notice');
const cards=page.locator('#station-customer-credit .os-credit-account');
await expect(cards).toHaveCount(3,{timeout:18000});
const refresh=page.locator('#station-customer-credit .os-credit-head button');
const pattern='**/api/station/customer-overview?*';
await page.route(pattern,route=>route.abort('internetdisconnected'));
await refresh.click();
await expect(notice).toContainText('ยังโหลดข้อมูลเครดิตไม่ได้',{timeout:10000});
await expect(cards).toHaveCount(0);
await expect(refresh).toBeEnabled();
await page.unroute(pattern);
await refresh.click();
await expect(notice).toContainText('อัปเดตบัญชี 3 รายการจากฐานข้อมูล',{timeout:15000});
await expect(cards).toHaveCount(3,{timeout:15000});
console.log('MASTER_CASE X-06-V NETWORK_FAILURE_VISIBLE_AND_RETRY_RECOVERY_PASS');
}});
