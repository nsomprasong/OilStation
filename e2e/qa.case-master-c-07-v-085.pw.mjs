import {masterCase,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='C-07-V';
masterCase({id:MASTER_UAT_ID,description:'zero-credit-state-accurately-shown',alias:'s02b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_S02B,
 check:async({page,auth,headers,expect,BASE})=>{
const res=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_S02B,{headers});
expect(res.status()).toBe(200);const accounts=(await res.json()).accounts;
expect(accounts).toHaveLength(3);
for(const account of accounts)for(const key of ['availableSatang','prepaidSatang','creditLimitSatang','debtSatang','reservedSatang','pendingTopupSatang'])expect(String(account[key]),'QA S02B '+key+' zero').toBe('0');
await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
const credit=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');await expect(credit).toBeVisible();await credit.click();
const cards=page.locator('#station-customer-credit .os-credit-account');
await expect(cards).toHaveCount(3,{timeout:17000});
for(let i=0;i<3;i++){
 await expect(cards.nth(i).locator('.os-credit-available')).toHaveText('0.00 ฿');
 const details=cards.nth(i).locator('.os-credit-detail strong');await expect(details).toHaveCount(5);
 for(let k=0;k<5;k++)await expect(details.nth(k)).toHaveText('0.00 ฿');
}
console.log('MASTER_CASE C-07-V ZERO_PREPAID_DEBT_RESERVED_AND_AVAILABLE_DISPLAYED_NOT_FAKE_CREDIT_PASS; real overdraft lane blocked');
}});
