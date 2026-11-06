import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {readFileSync} from 'node:fs';
import {STATION_S02A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: only six new authorized QA acceptance cases.
const MASTER_UAT_ID='X-06-F';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-06-F evidence verification',alias:'s02a-hr',role:'hr_manager',scopeType:'station',scopeId:'24dc4981-0e6f-4b86-bfd7-03717002d0be',check:async({page,headers,expect,BASE})=>{
const attendance=readFileSync('src/client/attendance.js','utf8');expect(attendance).toContain('if(pending && pending.eventType===eventType)');expect(attendance).toContain('data=pending;');expect(attendance).toContain("pending=null;");const m=readFileSync('supabase/migrations/20261029181000_gps_attendance_pending.sql','utf8');expect(m).toContain('IDEMPOTENCY_CONFLICT');const own=await page.request.get(BASE+'/api/hr/roster?stationId='+STATION_S02A,{headers});expect(own.status()).toBe(200);expect((await own.json()).roster.employees.length).toBeGreaterThan(0);console.log('MASTER_CASE X-06-F GPS_CLIENT_PENDING_KEY_REUSE_AND_SQL_CONFLICT_GUARD_SOURCE_PASS (network-loss attendance POST not executed)');
}});
