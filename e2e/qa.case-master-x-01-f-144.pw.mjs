import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {test as pwTest} from '@playwright/test';
// OILSTATION_QA_BATCH_RUN: six new guarded specs, never repeat passed tests.
const MASTER_UAT_ID='X-01-F';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-01-F QA evidence',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',check:async({page,headers,expect,BASE})=>{
const invalid=await page.request.get(BASE+'/api/fuel/report?stationId=not-a-valid-uuid',{headers});expect(invalid.status()).toBe(400);const payload=await invalid.json();expect(payload).toEqual({error:'invalid_report_filter'});const body=JSON.stringify(payload);expect(body).not.toMatch(/service_role|postgres|stack|secret|SELECT |Bearer |@/i);await pwTest.info().attach('master-144-redacted-error.json',{body:Buffer.from(body),contentType:'application/json'});const records=await page.request.get(BASE+'/api/station/customer-overview?stationId=e22fb5ff-1878-446f-ab8d-585115e8a1a9',{headers});expect(records.status()).toBe(200);console.log('MASTER_CASE X-01-F_INVALID_REPORT_FILTER_REDACTED_ERROR_EVIDENCE_ATTACHED_PASS (CI failure-log sanitization not proved)');
}});
