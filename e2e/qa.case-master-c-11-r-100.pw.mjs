import {masterCase,STATION_A,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected never-run corporate tenant-isolation check.
const MASTER_UAT_ID='C-11-R';
const COMPANY_C02='7f3dae09-5ff4-409c-bdf8-049086f99b7a';
masterCase({id:MASTER_UAT_ID,description:'c02-admin-denied-c01-completed-fuel-report',alias:'c02-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C02,
 check:async({page,headers,expect,BASE})=>{
  const own=await page.request.get(BASE+'/api/fuel/report?'+new URLSearchParams({stationId:STATION_A,companyId:COMPANY_C02}),{headers});
  expect(own.status()).toBe(200);const ownRows=(await own.json()).rows;expect(Array.isArray(ownRows)).toBe(true);
  expect(ownRows.every(x=>x.companyName==='QA-S01-A-C02')).toBe(true);
  const foreign=await page.request.get(BASE+'/api/fuel/report?'+new URLSearchParams({stationId:STATION_A,companyId:COMPANY_C01}),{headers});
  expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'permission_denied'});
  console.log('MASTER_CASE C-11-R C02_REAL_REPORT_200_C01_FOREIGN_REPORT_403_PASS');
 }});
