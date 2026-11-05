import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='S-01-F';
masterCase({id:MASTER_UAT_ID,description:'station-owned-context-after-reload',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const before=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers});expect(before.status()).toBe(200);
const fuels=(await before.json()).fuels;expect(Array.isArray(fuels)).toBe(true);
await page.locator('[data-ws-screen="overview"] [data-ws-go="fuel"]:visible').first().click();
await expect(page.locator('[data-ws-screen="fuel"]:visible')).toBeVisible();
await page.reload({waitUntil:'domcontentloaded'});
await expect(page.locator('[data-ws-screen="overview"]')).toHaveCount(1);
const token=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{return JSON.parse(localStorage.getItem(k)).access_token;}catch{}}return null;});expect(token).toBeTruthy();
const another=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers:{authorization:'Bearer '+token}});expect(another.status()).toBe(200);
expect((await another.json()).fuels).toEqual(fuels);
console.log('MASTER_CASE S-01-F OWN_STATION_CONTEXT_FUELS_PERSIST_AFTER_RELOAD_PASS');
}});
