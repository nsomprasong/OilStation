import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: protected six entirely new cases.
const MASTER_UAT_ID='X-03-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-03-R authenticated UAT',alias:'c02-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'7f3dae09-5ff4-409c-bdf8-049086f99b7a',check:async({page,headers,expect,BASE})=>{
expect(await page.locator('[data-ws-go="stations"]').count()).toBe(0);expect(await page.locator('[data-ws-go="sales"]').count()).toBe(0);const forbidden=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_A,{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});const sales=await page.request.get(BASE+'/api/platform/sales/workspace',{headers});expect(sales.status()).toBe(403);expect(await sales.json()).toEqual({error:'permission_denied'});const own=await page.request.get(BASE+'/api/my-accounts',{headers});expect(own.status()).toBe(200);console.log('MASTER_CASE X-03-R HIDDEN_NAV_IS_NOT_ACCESS_CONTROL_SERVER_REJECTS_STATION_AND_SALES_READS_PASS');
}});
