import {masterCase,STATION_A,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: driver does NOT gain corporate fuel history authorization.
const MASTER_UAT_ID='C-12-R';
masterCase({id:MASTER_UAT_ID,description:'driver-own-qr-allowed-but-company-fuel-reports-denied',alias:'c01-driver',role:'driver',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,headers,expect,BASE})=>{
  await page.setViewportSize({width:390,height:844});
  expect(await page.locator('[data-ws-screen="corporate"]').count()).toBe(0);
  expect(await page.locator('#company-fuel-report').count()).toBe(0);
  const own=await page.request.get(BASE+'/api/driver/coupons',{headers});
  expect(own.status()).toBe(200);expect(Array.isArray((await own.json()).vehicles)).toBe(true);
  for(const qp of [new URLSearchParams({stationId:STATION_A,companyId:COMPANY_C01}),
                   new URLSearchParams({stationId:STATION_A})]){
    const denied=await page.request.get(BASE+'/api/fuel/report?'+qp,{headers});
    expect(denied.status()).toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});
  }
  console.log('MASTER_CASE C-12-R DRIVER_OWN_QR_200_CORPORATE_FUEL_HISTORY_403_PASS');
 }});
