import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded new Master case only.
const MASTER_UAT_ID='P-04-V';
masterCase({id:MASTER_UAT_ID,description:'bounded P-04-V new safe QA acceptance',alias:'s02b-hr',role:'hr_manager',scopeType:'station',scopeId:'02183a4e-47b0-4575-9f4f-74cec6553205',check:async({page,headers,expect,BASE})=>{
const get=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_S02B,{headers});expect(get.status()).toBe(403);expect(await get.json()).toEqual({error:'hr_module_not_enabled'});const write=await page.request.post(BASE+'/api/hr/assign-shift',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_S02B,employeeId:'00000000-0000-4000-8000-000000000130',templateId:'00000000-0000-4000-8000-000000000131',date:'2026-11-15'}});expect(write.status()).toBe(403);expect(await write.json()).toEqual({error:'hr_module_not_enabled'});console.log('MASTER_CASE P-04-V QA_S02B_DISABLED_HR_MODULE_DENIES_ROSTER_AND_SHIFT_NO_WRITES_PASS (enabled service positive activation not covered)');
}});
