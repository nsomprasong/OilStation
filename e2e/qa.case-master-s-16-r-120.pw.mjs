import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// FAILED_ONLY_RECOVERY_20261106
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-16-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-16-R tenant denied action',alias:'s02a-hr',role:'hr_manager',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const known=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_S02A,{headers});expect(known.status()).toBe(200);const foreign=await page.request.post(BASE+'/api/hr/assign-shift',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,employeeId:'00000000-0000-4000-8000-000000000120',templateId:'00000000-0000-4000-8000-000000000121',date:'2026-11-15'}});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'cross_station_forbidden'});const same=await page.request.post(BASE+'/api/hr/assign-shift',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_S02A,employeeId:'00000000-0000-4000-8000-000000000120',templateId:'00000000-0000-4000-8000-000000000121',date:'2026-11-15'}});expect(same.status()).toBe(403);expect(await same.json()).toEqual({error:'qa_hr_write_disabled'});console.log('MASTER_CASE S-16-R FOREIGN_STATION_SHIFT_ASSIGNMENT_DENIED_BEFORE_DB_PASS');
}});
