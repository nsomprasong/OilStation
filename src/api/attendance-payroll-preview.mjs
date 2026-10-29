import {reviewedWorkMinutes} from '../domain/approved-work-time.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createAttendancePayrollPreviewApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/hr/attendance/payroll-preview')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!auth)return json(401,{error:'unauthenticated'});
  const employeeId=url.searchParams.get('employeeId'),from=url.searchParams.get('from'),
    until=url.searchParams.get('until');
  if(!UUID.test(employeeId??'')||!ISO.test(from??'')||!ISO.test(until??'')||
     !Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(until))||
     Date.parse(until)<=Date.parse(from)||
     Date.parse(until)>Date.parse(from)+35*86400000)
   return json(400,{error:'invalid_payroll_preview_period'});
  try{
   const user=await authenticate(auth[1]);
   if(!UUID.test(user?.id??''))return json(401,{error:'unauthenticated'});
   const result=await db.hrReviewedAttendancePunches({
    actorId:user.id,employeeId,from,until});
   if(result?.status!=='preview_only'||result.payable!==false||
      result.faceVerified!==false||!Array.isArray(result.events))
    throw new Error('unsafe_payroll_context');
   const minutes=reviewedWorkMinutes(result.events);
   return json(200,{employeeId,period:{from,until},status:'preview_only',
     payable:false,faceVerified:false,...minutes});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='PUNCH_REVIEW_REQUIRED'||e?.code==='INVALID_REQUEST')
    return json(409,{error:'unreviewed_or_incomplete_punches'});
   // An incomplete pair or a failed database read is NOT a salary approval.
   return json(409,{error:'unreviewed_or_incomplete_punches'});
  }
 };
}
