import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {qaLogin} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded fresh cases.
const MASTER_UAT_ID='X-03-H';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-03-H authorized evidence',alias:'sales01',role:'platform_sales',scopeType:'platform',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/platform/sales/stations',{headers});expect(own.status()).toBe(200);const stations=(await own.json()).stations;expect(stations).toHaveLength(2);const forbidden=await page.request.get(BASE+'/api/platform/support/overview',{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE X-03-H SALES_STATION_READ_PERMITTED_SUPPORT_READ_DENIED_BY_SERVER_PASS (mutating workflows not exercised)');
}});
