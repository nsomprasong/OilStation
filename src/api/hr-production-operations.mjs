/**
 * Narrow, live HR-only lane for real station actors while general Production
 * finance remains disabled. No payroll writes, bank details, advances or payout.
 * All delegated RPCs retain their own independent actor/tenant authorization.
 */
import {createApi} from './router.mjs';
import {createGpsAttendanceApi} from './attendance.mjs';
import {createAttendanceReviewApi} from './attendance-review.mjs';
import {createAttendancePayrollPreviewApi} from './attendance-payroll-preview.mjs';
import {createPayrollReadinessApi} from './hr-payroll-readiness.mjs';
import {createPayrollPolicyApi} from './hr-payroll-policy.mjs';
import {createPayrollDraftApi} from './hr-payroll-draft.mjs';
import {createLeaveApi} from './hr-leave.mjs';
import {qaIsEnabled,qaScopeAllowlist} from './qa-accounts.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF_ROLES=new Set([
 'station_owner','owner','manager','hr_manager','cashier','attendant','pump_staff',
]);
const MANAGER_ROLES=new Set(['station_owner','owner','manager','hr_manager']);

// Forbid payroll write endpoints even with a valid owner token. This route
// list is exhaustive; any new HR endpoint must receive explicit review.
const ROUTES=new Map([
 ['/api/hr/roster','GET'],['/api/hr/link-setup','GET'],
 ['/api/hr/pending-substitutes','GET'],['/api/hr/pending-ot','GET'],
 ['/api/hr/attendance/pending','GET'],
 ['/api/hr/attendance/payroll-preview','GET'],
 ['/api/hr/payroll/readiness','GET'],['/api/hr/payroll/policies','GET'],
 ['/api/hr/payroll/drafts','GET'],['/api/hr/leave','GET'],
 ['/api/hr/employees','POST'],['/api/hr/employee-link','POST'],
 ['/api/hr/geofence','POST'],['/api/hr/seed-shifts','POST'],
 ['/api/hr/assign-shift','POST'],['/api/hr/request-substitute','POST'],
 ['/api/hr/review-substitute','POST'],['/api/hr/request-ot','POST'],
 ['/api/hr/review-ot','POST'],['/api/hr/attendance/gps','POST'],
 ['/api/hr/attendance/review','POST'],
 ['/api/hr/leave/request','POST'],['/api/hr/leave/review','POST'],
]);
const MANAGER_ONLY=new Set([
 '/api/hr/roster','/api/hr/link-setup',
 '/api/hr/pending-substitutes','/api/hr/pending-ot',
 '/api/hr/attendance/pending','/api/hr/attendance/payroll-preview',
 '/api/hr/payroll/readiness','/api/hr/payroll/policies',
 '/api/hr/payroll/drafts',
 '/api/hr/employees','/api/hr/employee-link','/api/hr/geofence',
 '/api/hr/seed-shifts','/api/hr/assign-shift',
 '/api/hr/review-substitute','/api/hr/review-ot',
 '/api/hr/attendance/review','/api/hr/leave/review',
]);
const response=(status,error)=>new Response(JSON.stringify({error}),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'private,no-store','x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'},
});
export const PRODUCTION_HR_ROUTES=Object.freeze([...ROUTES.keys()]);

export function createProductionHrOperationsApi({env,authenticate,db}){
 return async request=>{
  const url=new URL(request.url),method=ROUTES.get(url.pathname);
  if(env?.OILSTATION_DEPLOY_TARGET!=='production' ||
     env?.OILSTATION_PREVIEW_LOGIN_ENABLED!=='true' ||
     env?.OILSTATION_PREVIEW_OPERATIONS_ENABLED!=='true' ||
     env?.OILSTATION_API_ENABLED==='true' ||
     env?.OILSTATION_HR_OPERATIONS_ENABLED!=='true')
   return response(503,'hr_operations_not_enabled');
  if(!method)return response(404,'not_found');
  if(request.method!==method)return response(405,'method_not_allowed');
  if(method==='POST'){
   if(request.headers.get('origin')!==url.origin)
    return response(403,'origin_forbidden');
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return response(415,'unsupported_media_type');
   if(Number(request.headers.get('content-length'))>16384)
    return response(413,'body_too_large');
  }
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return response(401,'unauthenticated');
  let body={};
  if(method==='POST'){
   try{
    const raw=await request.clone().text();
    if(raw.length>16384)return response(413,'body_too_large');
    body=JSON.parse(raw);
    if(!body||typeof body!=='object'||Array.isArray(body))
     return response(400,'invalid_json');
   }catch{return response(400,'invalid_json');}
  }
  try{
   const actor=await authenticate(token);
   // Even if synthetic QA staff have valid station memberships they must
   // never use the real HR lane; temporary QA overrides are separate.
   if(!UUID.test(actor?.id||''))return response(401,'unauthenticated');
   if(actor.isQa===true){
    // QA can only READ its own entitled station roster or get a denied shift
    // write. No successful QA HR mutation is possible in this production lane.
    if(!qaIsEnabled(env)||!['/api/hr/roster','/api/hr/assign-shift'].includes(url.pathname))
      return response(403,'qa_identity_not_live');
    const allowed=qaScopeAllowlist(env).station;
    if(allowed.length!==4||new Set(allowed).size!==4)
      return response(503,'qa_scope_unavailable');
    const qaMembers=(await db.memberships(actor.id)||[]).filter(m=>
      m.active===true&&m.scope_type==='station'&&allowed.includes(m.station_id)&&
      MANAGER_ROLES.has(m.role_code));
    if(qaMembers.length!==1)return response(403,'qa_station_only');
    const stationId=method==='GET'?url.searchParams.get('stationId'):body.stationId;
    if(!UUID.test(stationId||''))return response(400,'invalid_station');
    if(stationId!==qaMembers[0].station_id)
      return response(403,'cross_station_forbidden');
    if((await db.hrModuleEntitled({actorId:actor.id,stationId}))!==true)
      return response(403,'hr_module_not_enabled');
    if(method==='POST')return response(403,'qa_hr_write_disabled');
    const roster=await db.hrRoster({actorId:actor.id,stationId});
    return new Response(JSON.stringify({roster}),{status:200,headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'private,no-store','x-content-type-options':'nosniff'}});
   }
   const memberships=await db.memberships(actor.id);
   if(!Array.isArray(memberships))return response(503,'hr_operations_unavailable');
   const own=memberships.filter(m=>m.active===true&&m.scope_type==='station'&&
    UUID.test(m.station_id||'')&&STAFF_ROLES.has(m.role_code));
   if(!own.length)return response(403,'station_membership_required');
   const requestedStation=method==='GET'?url.searchParams.get('stationId'):
    Object.hasOwn(body,'stationId')?body.stationId:null;
   if(requestedStation!==null&&!UUID.test(requestedStation))
    return response(400,'invalid_station');
   // An employee-/event-scoped API does not carry stationId. For these routes
   // require one active station scope, then let the trusted RPC enforce the
   // employee/event-to-station link. Never guess across two station memberships.
   if(requestedStation===null&&new Set(own.map(m=>m.station_id)).size!==1)
    return response(403,'explicit_station_scope_required');
   const stationId=requestedStation||own[0].station_id;
   const member=own.find(m=>m.station_id===stationId);
   if(!member)return response(403,'cross_station_forbidden');
   if(MANAGER_ONLY.has(url.pathname)&&!own.some(m=>
    m.station_id===stationId&&MANAGER_ROLES.has(m.role_code)))
    return response(403,'manager_required');
   // Entitlement check is also imposed on employee self-service operations,
   // whose original leave RPCs do not check station_modules themselves.
   if((await db.hrModuleEntitled({actorId:actor.id,stationId}))!==true)
    return response(403,'hr_module_not_enabled');
   const deps={authenticate,db};
   if(url.pathname==='/api/hr/attendance/gps')
    return createGpsAttendanceApi(deps)(request);
   if(url.pathname==='/api/hr/attendance/review' ||
      url.pathname==='/api/hr/attendance/pending')
    return createAttendanceReviewApi(deps)(request);
   if(url.pathname==='/api/hr/attendance/payroll-preview')
    return createAttendancePayrollPreviewApi(deps)(request);
   if(url.pathname==='/api/hr/payroll/readiness')
    return createPayrollReadinessApi(deps)(request);
   if(url.pathname==='/api/hr/payroll/policies')
    return createPayrollPolicyApi(deps)(request);
   if(url.pathname==='/api/hr/payroll/drafts')
    return createPayrollDraftApi(deps)(request);
   if(url.pathname==='/api/hr/leave'||
      url.pathname==='/api/hr/leave/request'||
      url.pathname==='/api/hr/leave/review')
    return createLeaveApi(deps)(request);
   return createApi(deps)(request);
  }catch{
   return response(503,'hr_operations_unavailable');
  }
 };
}
