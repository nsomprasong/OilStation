import {masterCase,STATION_A,STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='P-13-R';
masterCase({id:MASTER_UAT_ID,description:'sales01-cross-sales02-inspection-denied',alias:'sales01',role:'platform_sales',scopeType:'platform',
check:async({page,headers,expect,BASE})=>{
const endpoint=id=>BASE+'/api/platform/sales/inspection?stationId='+id;
const own=await page.request.get(endpoint(STATION_A),{headers});expect(own.status()).toBe(200);
const ownResult=(await own.json()).result;expect(ownResult.station.id).toBe(STATION_A);
for(let i=0;i<2;i++){const other=await page.request.get(endpoint(STATION_S02A),{headers});
 expect(other.status()).toBe(403);expect(await other.json()).toEqual({error:'permission_denied'});}
console.log('MASTER_CASE P-13-R SALES01_CANNOT_INSPECT_OTHER_SALES_STATION_PASS');
}});
