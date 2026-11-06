import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is enforced in the protected helper.
const MASTER_UAT_ID='S-03-V';
masterCase({id:MASTER_UAT_ID,description:'unknown-fuel-id-safely-rejected',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const before=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(before.status()).toBe(200);const fuels=(await before.json()).fuels;expect(Array.isArray(fuels)).toBe(true);
const invalid=await page.request.post(BASE+'/api/station-fuel-config',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_B,stationFuelId:'00000000-0000-4000-8000-000000000056',enabled:false,publicPrice:'32.50'}});
expect(invalid.status(),'unknown existing fuel id must return 404').toBe(404);
expect(await invalid.json()).toEqual({error:'not_found'});
const after=await page.request.get(BASE+'/api/station-fuels?stationId='+STATION_B,{headers});expect(after.status()).toBe(200);expect((await after.json()).fuels).toEqual(fuels);
console.log('MASTER_CASE S-03-V UNKNOWN_FUEL_ID_DENIED_PASS '+invalid.status());
}});
