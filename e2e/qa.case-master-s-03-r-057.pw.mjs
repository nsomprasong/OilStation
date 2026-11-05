import {masterCase,STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='S-03-R';
masterCase({id:MASTER_UAT_ID,description:'station-manager-cannot-price-foreign-station',alias:'s01b-manager',role:'manager',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(own.status()).toBe(200);const before=(await own.json()).fuels;
const forbidden=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_A,{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'permission_denied'});
const write=await page.request.post(BASE+'/api/station-fuel-config',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,stationFuelId:'00000000-0000-4000-8000-000000000057',publicPrice:'32.50',enabled:false}});
expect(write.status()).toBe(403);expect(await write.json()).toEqual({error:'permission_denied'});
const fresh=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(fresh.status()).toBe(200);expect((await fresh.json()).fuels).toEqual(before);
console.log('MASTER_CASE S-03-R FOREIGN_STATION_MANAGER_FUEL_READ_AND_WRITE_DENIED_PASS');
}});
