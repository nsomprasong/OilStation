import {qaIsEnabled,qaScopeAllowlist} from './qa-accounts.mjs';
import {qaUatWindowOpen} from './qa-uat-window.mjs';
import {createApi} from './router.mjs';
import {createAttendanceReviewApi} from './attendance-review.mjs';
import {createAttendancePayrollPreviewApi} from './attendance-payroll-preview.mjs';
import {createGpsAttendanceApi} from './attendance.mjs';

// Fixed QA actor + four-station boundary while all general production APIs stay OFF.
// Never accept real employee/payroll actors, cross-station writes or real payments.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paths=new Map([
 ['/api/hr/roster','GET'],['/api/hr/employees','POST'],
 ['/api/hr/seed-shifts','POST'],['/api/hr/assign-shift','POST'],
 ['/api/hr/request-substitute','POST'],['/api/hr/review-substitute','POST'],
 ['/api/hr/pending-substitutes','GET'],['/api/hr/request-ot','POST'],
 ['/api/hr/review-ot','POST'],['/api/hr/pending-ot','GET'],
 ['/api/hr/attendance/pending','GET'],['/api/hr/attendance/review','POST'],
 ['/api/hr/attendance/payroll-preview','GET'],
 ['/api/hr/attendance/gps','POST'],
]);
const reply=(code,error)=>new Response(JSON.stringify({error}),{
 status:code,headers:{'content-type':'application/json','cache-control':'private,no-store'},
});
export function createQaHrUatApi({env,authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const method=paths.get(url.pathname);
  if(!qaIsEnabled(env)||env.OILSTATION_QA_HR_UAT_ENABLED!=='true'||!qaUatWindowOpen(env))
   return reply(404,'not_found');
  if(!method)return reply(404,'not_found');
  if(request.method!==method)return reply(405,'method_not_allowed');
  if(method==='POST'&&request.headers.get('origin')!==url.origin)
   return reply(403,'origin_forbidden');
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return reply(401,'unauthenticated');
  const allowed=qaScopeAllowlist(env).station;
  if(allowed.length!==4||new Set(allowed).size!==4)
   return reply(503,'qa_scope_unavailable');
  try{
   const actor=await authenticate(token);
   if(!UUID.test(actor?.id||'')||actor?.isQa!==true)return reply(403,'qa_actor_only');
   const members=(await db.memberships(actor.id)||[]).filter(m=>m.active===true&&
      m.scope_type==='station'&&allowed.includes(m.station_id));
   if(members.length!==1)return reply(403,'qa_station_only');
   const member=members[0];
   if(!['station_owner','owner','manager','hr_manager','cashier','attendant','pump_staff',
       'finance_manager'].includes(member.role_code))
    return reply(403,'permission_denied');
   // Paths with an explicit stationId are checked before delegation; indirect
   // employee/event IDs remain subject to the existing DB RPC role/scope checks.
   let stationId=url.searchParams.get('stationId');
   if(method==='POST'){
    if(Number(request.headers.get('content-length'))>16384)return reply(413,'body_too_large');
    const raw=await request.clone().text();
    if(raw.length>16384)return reply(413,'body_too_large');
    let body;try{body=JSON.parse(raw);}catch{return reply(400,'invalid_json');}
    if(body&&Object.hasOwn(body,'stationId'))stationId=body.stationId;
   }
   if(stationId!==null&&stationId!==member.station_id)return reply(403,'cross_station_forbidden');
   const deps={authenticate,db};
   if(url.pathname==='/api/hr/attendance/pending'||url.pathname==='/api/hr/attendance/review')
    return createAttendanceReviewApi(deps)(request);
   if(url.pathname==='/api/hr/attendance/payroll-preview')
    return createAttendancePayrollPreviewApi(deps)(request);
   if(url.pathname==='/api/hr/attendance/gps')
    return createGpsAttendanceApi(deps)(request);
   return createApi(deps)(request);
  }catch{
   return reply(503,'qa_hr_unavailable');
  }
 };
}
