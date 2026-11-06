import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: only six new authorized QA acceptance cases.
const MASTER_UAT_ID='S-20-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded S-20-R evidence verification',alias:'s01a-cashier',role:'cashier',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const forbidden=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_A,{headers});expect(forbidden.status()).toBe(403);expect(await forbidden.json()).toEqual({error:'qa_station_only'});for(const path of ['/api/hr/payroll/drafts/review','/api/hr/payroll/export']){const blocked=await page.request.get(BASE+path,{headers});expect(blocked.status(),path).toBe(503);expect(await blocked.json()).toEqual({error:'release_not_enabled'});}console.log('MASTER_CASE S-20-R QA_CASHIER_DENIED_HR_ROSTER_AND_PAYROLL_FINALIZE_EXPORT_GLOBALLY_BLOCKED_PASS (enabled payroll role comparison pending)');
}});
