import {masterCase,STATION_A,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: hidden station/finance/platform panes must also be API-denied.
const MASTER_UAT_ID='S-22-R';
masterCase({id:MASTER_UAT_ID,description:'corporate-admin-hidden-station-billing-tabs-also-denied-server-side',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,headers,expect,BASE})=>{
  for(const tab of ['customers','finance','plan','billing','stations','payroll','hr']){
    expect(await page.locator('[data-ws-screen="'+tab+'"]').count()).toBe(0);
  }
  const own=await page.request.get(BASE+'/api/my-accounts',{headers});
  expect(own.status()).toBe(200);expect((await own.json()).accounts.length).toBeGreaterThan(0);
  for(const url of [
    '/api/station/customer-overview?'+new URLSearchParams({stationId:STATION_A}),
    '/api/station/billing/options?'+new URLSearchParams({stationId:STATION_A}),
    '/api/platform/billing/overview'
  ]){const denied=await page.request.get(BASE+url,{headers});expect(denied.status(),'server must enforce owner-only station/platform service').toBe(403);expect(await denied.json()).toEqual({error:'permission_denied'});}
  console.log('MASTER_CASE S-22-R HIDDEN_STATION_TABS_AND_THREE_SERVER_ROLE_GATES_403_PASS');
 }});
