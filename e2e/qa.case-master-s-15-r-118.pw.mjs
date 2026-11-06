import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A,STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// FAILED_ONLY_RECOVERY_20261106
// OILSTATION_QA_BATCH_RUN protected by masterCase.
const MASTER_UAT_ID='S-15-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-15-R tenant denied action',alias:'s02a-hr',role:'hr_manager',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_S02A,{headers});expect(own.status()).toBe(200);const roster=(await own.json()).roster;expect(Array.isArray(roster.employees)).toBe(true);expect(roster.employees.length).toBeGreaterThan(0);const foreign=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_A,{headers});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'cross_station_forbidden'});console.log('MASTER_CASE S-15-R HR_MANAGER_S02A_CANNOT_VIEW_S01A_EMPLOYEE_ROSTER_PASS');
}});
