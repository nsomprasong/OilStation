import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGeofence} from '../../src/domain/geofence.mjs';
import {createGpsAttendanceApi} from '../../src/api/attendance.mjs';
const USER='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const URL='https://oilstation.goldensoft.cloud/api/hr/attendance/gps';
const payload={stationId:STATION,eventType:'clock_in',latitude:13.7563,
 longitude:100.5018,accuracyMeters:10,idempotencyKey:'gps-checkin-20261029'};
test('distance and uncertainty must consider GPS accuracy',()=>{
 const base={stationLatitude:13.7563,stationLongitude:100.5018,radiusMeters:150};
 assert.equal(evaluateGeofence({...base,latitude:13.7563,longitude:100.5018,accuracyMeters:10}).status,'inside');
 assert.equal(evaluateGeofence({...base,latitude:13.7563,longitude:100.5058,accuracyMeters:10}).status,'outside');
 assert.equal(evaluateGeofence({...base,latitude:13.7563,longitude:100.5029,accuracyMeters:50}).status,'uncertain');
 assert.equal(evaluateGeofence({...base,latitude:13.7563,longitude:100.5018,accuracyMeters:250}).status,'uncertain');
 assert.equal(evaluateGeofence({...base,stationLatitude:null,latitude:13.7563,longitude:100.5018,accuracyMeters:10}).status,'unconfigured');
});
function app(){
 const calls=[];
 const handler=createGpsAttendanceApi({authenticate:async t=>t==='good'?{id:USER}:null,
 db:{hrRecordGps:async d=>{calls.push(d);return {id:USER,status:'pending',faceVerified:false};}}});
 return {calls,handler};
}
const request=(data=payload,extra={})=>new Request(URL,{method:'POST',headers:{
 'content-type':'application/json',authorization:'Bearer good',...extra},body:JSON.stringify(data)});
test('a GPS punch never becomes accepted or face-verified from client values',async()=>{
 const a=app(),r=await a.handler(request());
 assert.equal(r.status,202);
 assert.equal((await r.json()).attendance.status,'pending');
 assert.equal(a.calls[0].actorId,USER);
});
test('reject invalid GPS, missing auth, invalid retry key and cross-origin',async()=>{
 const a=app();
 assert.equal((await a.handler(request({...payload,latitude:200}))).status,400);
 assert.equal((await a.handler(request({...payload,idempotencyKey:'short'}))).status,400);
 assert.equal((await a.handler(request(payload,{authorization:'Bearer bad'}))).status,401);
 assert.equal((await a.handler(request(payload,{origin:'https://evil.invalid'}))).status,403);
 assert.equal(a.calls.length,0);
});
