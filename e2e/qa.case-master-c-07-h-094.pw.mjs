import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='C-07-H';
masterCase({id:MASTER_UAT_ID,description:'corporate-credit-banner-real-satang-reconciliation',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const res=await page.request.get(BASE+'/api/my-accounts',{headers});expect(res.status()).toBe(200);
const accounts=(await res.json()).accounts;expect(accounts).toHaveLength(1);
const a=accounts[0];expect(a.companyId).toBe(COMPANY_C01);
const balance=BigInt(a.prepaidSatang)+BigInt(a.creditLimitSatang)-BigInt(a.debtSatang)-BigInt(a.reservedSatang);
expect(BigInt(a.availableSatang)).toBe(balance>0n?balance:0n);
const money=value=>{const n=BigInt(value);return '฿'+(n/100n).toLocaleString('th-TH')+'.'+String(n%100n).padStart(2,'0');};
await page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first().click();
await expect(page.locator('[data-ws-screen="corporate"]:visible')).toBeVisible();
const tab=page.locator('[data-context-for="corporate"] button[data-os-pane-key="account"]');await expect(tab).toBeVisible();await tab.click();
const banner=page.locator('#corp-remaining-credit');await expect(banner).toBeVisible({timeout:20000});
await expect(banner).toContainText(a.stationName);await expect(banner).toContainText(money(a.availableSatang));
const cards=page.locator('#account-overview .balance-card');await expect(cards).toHaveCount(1);
await expect(cards.first().locator('.money')).toHaveText(money(a.availableSatang));
const latest=await page.request.get(BASE+'/api/my-accounts',{headers});expect(latest.status()).toBe(200);
expect((await latest.json()).accounts).toEqual(accounts);
console.log('MASTER_CASE C-07-H CORPORATE_AVAILABLE_PREPAID_CREDIT_DEBT_RESERVED_AND_HEADER_MATCH_DB_PASS');
}});
