// Leave records and approval only. Wage entitlement, attendance and payroll
// remain unchanged until a separately reviewed station wage/leave policy exists.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const day=s=>{
 if(typeof s!=='string'||!DATE.test(s))return null;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?d:null;
};
const routes=Object.freeze({
 '/api/hr/leave':'GET',
 '/api/hr/leave/request':'POST',
 '/api/hr/leave/review':'POST',
});
const response=(code,payload)=>new Response(JSON.stringify(payload),{
 status:code,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'private,no-store','x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'},
});
const fail=(code,error)=>response(code,{error});
export function createLeaveApi({authenticate,db}){
 return async request=>{
  const path=new URL(request.url).pathname,method=routes[path];
  if(!method)return fail(404,'not_found');
  if(request.method!==method)return fail(405,'method_not_allowed');
  const url=new URL(request.url);
  if(method==='POST'){
   if(request.headers.get('origin')!==url.origin)return fail(403,'origin_forbidden');
   if(!(request.headers.get('content-type')||'').startsWith('application/json'))
    return fail(415,'unsupported_media_type');
  }
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!auth)return fail(401,'unauthenticated');
  let body={};
  if(method==='POST'){
   if(Number(request.headers.get('content-length'))>2048)return fail(413,'body_too_large');
   const raw=await request.text();
   if(raw.length>2048)return fail(413,'body_too_large');
   try{body=JSON.parse(raw);}catch{return fail(400,'invalid_json');}
   if(!body||Array.isArray(body)||typeof body!=='object')return fail(400,'invalid_body');
  }
  let actor;
  try{actor=await authenticate(auth);}catch{return fail(401,'unauthenticated');}
  if(!UUID.test(actor?.id||''))return fail(401,'unauthenticated');
  try{
   if(path==='/api/hr/leave'){
    const employeeId=url.searchParams.get('employeeId');
    if(!UUID.test(employeeId||''))return fail(400,'invalid_employee');
    const items=await db.hrLeaveList({actorId:actor.id,employeeId});
    if(!Array.isArray(items))throw new Error('invalid_db_reply');
    return response(200,{items,payrollImpact:'undetermined',deducted:false,payable:false});
   }
   if(path==='/api/hr/leave/request'){
    const start=day(body.startDate),end=day(body.endDate),types=new Set(['annual','sick','personal','unpaid']);
    if(!UUID.test(body.employeeId||'')||!types.has(body.leaveType)||
       !start||!end||end<start||end-start>30*86400000||
       (body.reason!==undefined&&(typeof body.reason!=='string'||body.reason.length>500)))
     return fail(400,'invalid_leave');
    const result=await db.hrLeaveRequest({actorId:actor.id,employeeId:body.employeeId,
     leaveType:body.leaveType,startDate:body.startDate,endDate:body.endDate,
     reason:body.reason||null});
    return response(201,{request:result,approved:false,payrollImpact:'undetermined',
     deducted:false,payable:false});
   }
   if(path==='/api/hr/leave/review'){
    if(!UUID.test(body.requestId||'')||typeof body.approved!=='boolean')
     return fail(400,'invalid_review');
    const result=await db.hrLeaveReview({actorId:actor.id,requestId:body.requestId,
     approved:body.approved});
    return response(200,{result,payrollImpact:'undetermined',deducted:false,payable:false});
   }
  }catch(e){
   if(e?.code==='FORBIDDEN'||e?.code==='SELF_APPROVAL_FORBIDDEN')
    return fail(403,'permission_denied');
   if(e?.code==='OVERLAPPING_LEAVE')return fail(409,'overlapping_leave');
   if(e?.code==='EMPLOYEE_NOT_ELIGIBLE'||e?.code==='NOT_FOUND')
    return fail(404,'employee_or_leave_not_found');
   if(['INVALID_LEAVE_DATES','INVALID_LEAVE_TYPE','INVALID_LEAVE_REASON',
        'INVALID_REVIEW'].includes(e?.code))return fail(400,'invalid_leave');
   return fail(503,'leave_unavailable');
  }
  return fail(404,'not_found');
 };
}
export const LEAVE_ROUTES=Object.freeze(Object.keys(routes));
