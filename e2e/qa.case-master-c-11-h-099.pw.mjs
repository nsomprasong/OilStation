import {masterCase,STATION_A,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: six new protected Master cases only.
const MASTER_UAT_ID='C-11-H';
masterCase({id:MASTER_UAT_ID,description:'corporate-completed-fuel-rows-match-own-real-report',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,headers,expect,BASE})=>{
  const endpoint=BASE+'/api/fuel/report?'+new URLSearchParams({stationId:STATION_A,companyId:COMPANY_C01});
  const res=await page.request.get(endpoint,{headers});expect(res.status()).toBe(200);
  const {rows}=await res.json();expect(Array.isArray(rows)).toBe(true);
  expect(rows.length,'pre-existing synthetic completed fuel rows; no generated receipt').toBeGreaterThan(0);
  for(const r of rows){expect(r.companyName).toBe('QA-S01-A-C01');expect(BigInt(r.amountSatang)>0n).toBe(true);expect(r.id).toBeTruthy();}
  await page.locator('[data-ws-screen="overview"] [data-ws-go="corporate"]:visible').first().click();
  await expect(page.locator('[data-ws-screen="corporate"]:visible')).toBeVisible();
  const tab=page.locator('[data-context-for="corporate"] button[data-os-pane-key="report"]');
  await expect(tab).toBeVisible({timeout:20000});await tab.click();
  const report=page.locator('#company-fuel-report');await expect(report).toBeVisible();
  await expect(report.locator('.os-report-notice')).toContainText('ข้อมูลจากรายการเติมน้ำมันที่ปิดงานแล้ว',{timeout:20000});
  await expect(report.locator('tbody tr')).toHaveCount(rows.length);
  for(const r of rows){await expect(report.locator('tbody')).toContainText(r.plate);await expect(report.locator('tbody')).toContainText(r.companyName);}
  console.log('MASTER_CASE C-11-H COMPLETED_FUEL_REPORT_REAL_COMPANY_ROWS_AND_MOBILE_SOURCE_PASS; invoice variant not proven');
 }});
