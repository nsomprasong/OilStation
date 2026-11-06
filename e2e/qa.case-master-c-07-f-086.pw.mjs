import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='C-07-F';
masterCase({id:MASTER_UAT_ID,description:'credit-reload-reconciles-nonzero-ledger',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const endpoint=BASE+'/api/station/customer-overview?stationId='+STATION_A;
const load=async()=>{const z=await page.request.get(endpoint,{headers});expect(z.status()).toBe(200);return (await z.json()).accounts;};
const first=await load();expect(first).toHaveLength(3);
expect(first.some(x=>BigInt(x.prepaidSatang||0)>0n),'existing synthetic wallet has confirmed nonzero balance').toBe(true);
const money=value=>{const v=/^\d{1,20}$/.test(String(value))?BigInt(value):0n;return (v/100n).toLocaleString('th-TH')+'.'+String(v%100n).padStart(2,'0')+' ฿';};
async function openCredit(){
 await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
 const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="credit"]');await expect(tab).toBeVisible();await tab.click();
 const cards=page.locator('#station-customer-credit .os-credit-account');await expect(cards).toHaveCount(3,{timeout:18000});return cards;
}
async function checkVisible(accounts){
 const cards=page.locator('#station-customer-credit .os-credit-account');
 for(let i=0;i<accounts.length;i++){
  await expect(cards.nth(i).locator('h4')).toHaveText(accounts[i].companyName);
  await expect(cards.nth(i).locator('.os-credit-available')).toHaveText(money(accounts[i].availableSatang));
  const vals=[accounts[i].prepaidSatang,accounts[i].creditLimitSatang,accounts[i].debtSatang,accounts[i].reservedSatang,accounts[i].pendingTopupSatang];
  const details=cards.nth(i).locator('.os-credit-detail strong');await expect(details).toHaveCount(5);
  for(let j=0;j<5;j++)await expect(details.nth(j)).toHaveText(money(vals[j]));
 }
}
await openCredit();await checkVisible(first);
await page.reload({waitUntil:'domcontentloaded'});
// SessionStorage intentionally restores the last authorized 'customers' screen;
// a reload is NOT expected to reset the shell to 'overview'.
await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible({timeout:35000});
await page.locator('[data-ws-go="overview"]:visible').first().click();
await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:15000});
await openCredit();
const second=await load();expect(second).toEqual(first);
await checkVisible(second);
console.log('MASTER_CASE C-07-F PERSISTED_NONZERO_CREDIT_RELOAD_MATCHES_SERVER_SIX_VALUES_PASS');
}});
