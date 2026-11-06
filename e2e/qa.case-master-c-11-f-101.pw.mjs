import {masterCase,STATION_A,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected never-run refresh/immutability variant.
const MASTER_UAT_ID='C-11-F';
masterCase({id:MASTER_UAT_ID,description:'same-immutable-fuel-rows-after-report-refresh',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,headers,expect,BASE})=>{
  const endpoint=BASE+'/api/fuel/report?'+new URLSearchParams({stationId:STATION_A,companyId:COMPANY_C01});
  const prior=await page.request.get(endpoint,{headers});expect(prior.status()).toBe(200);
  const initial=(await prior.json()).rows;expect(initial.length).toBeGreaterThan(0);
  await page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first().click();
  const tab=page.locator('[data-context-for="corporate"] button[data-os-pane-key="report"]');
  await expect(tab).toBeVisible({timeout:20000});await tab.click();
  const report=page.locator('#company-fuel-report');
  await expect(report.locator('.os-report-notice')).toContainText('ข้อมูลจากรายการเติมน้ำมันที่ปิดงานแล้ว',{timeout:20000});
  await expect(report.locator('tbody tr')).toHaveCount(initial.length);
  const again=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/fuel/report'&&
    new URL(r.url()).searchParams.get('companyId')===COMPANY_C01,{timeout:20000});
  await report.locator('button.os-report-select, .os-report-filters button').last().click();
  const browserResponse=await again;expect(browserResponse.status()).toBe(200);
  expect((await browserResponse.json()).rows).toEqual(initial);
  await expect(report.locator('tbody tr')).toHaveCount(initial.length);
  const fresh=await page.request.get(endpoint,{headers});expect(fresh.status()).toBe(200);
  expect((await fresh.json()).rows).toEqual(initial);
  console.log('MASTER_CASE C-11-F NO_DUPLICATE_FUEL_REPORT_ON_REFRESH_API_AND_UI_PASS');
 }});
