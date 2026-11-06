import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: mobile scoped dock/search/profile workflow, not prior Enter filter.
const MASTER_UAT_ID='S-22-H';
masterCase({id:MASTER_UAT_ID,description:'station-owner-mobile-home-task-search-dock-and-contextual-report',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,expect})=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.os-mobile-bottom')).toBeVisible();
  await expect(page.locator('.os-toolbar-profile')).toBeVisible();
  const slots=page.locator('.os-mobile-bottom .os-mobile-tab');await expect(slots).toHaveCount(5);
  const home=page.locator('[data-ws-screen="overview"]:visible');
  const search=home.locator('[data-mobile-search-input]');await expect(search).toBeVisible();
  await search.fill('ลูกค้าบริษัท');
  await expect(home.locator('[data-mobile-feature][data-ws-go="customers"]')).toBeVisible();
  await expect(home.locator('[data-mobile-feature][data-ws-go="fuel"]')).toBeHidden();
  await search.fill('');
  await home.locator('[data-mobile-feature][data-ws-go="customers"]').click();
  await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
  const tab=page.locator('[data-context-for="customers"] button[data-os-pane-key="report"]');
  await expect(tab).toBeVisible({timeout:20000});await tab.click();
  await expect(page.locator('#station-fuel-report-workspace .os-report-plate')).toBeVisible();
  await expect(page.locator('.os-mobile-bottom')).toBeVisible();
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+3);
  console.log('MASTER_CASE S-22-H MOBILE_FIVE_DOCK_SLOTS_PROFILE_SEARCH_CONTEXT_REPORT_AND_NO_OVERFLOW_PASS');
 }});
