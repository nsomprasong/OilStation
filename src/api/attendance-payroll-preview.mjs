import {reviewedWorkMinutes} from '../domain/approved-work-time.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=value=>typeof value==='string'&&DATE.test(value)&&
  Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
  new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
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
  const employeeId=url.searchParams.get('employeeId'),
    startDate=url.searchParams.get('startDate'),endDate=url.searchParams.get('endDate');
  if(!UUID.test(employeeId??'')||!validDate(startDate)||!validDate(endDate)||
     endDate<=startDate||Date.parse(endDate)>Date.parse(startDate)+35*86400000)
   return json(400,{error:'invalid_payroll_preview_period'});
  try{
   const user=await authenticate(auth[1]);
   if(!UUID.test(user?.id??''))return json(401,{error:'unauthenticated'});
   const result=await db.hrReviewedAttendancePunches({
    actorId:user.id,employeeId,startDate,endDate});
   if(result?.status!=='preview_only'||result.payable!==false||
      result.faceVerified!==false||!Array.isArray(result.events))
    throw new Error('unsafe_payroll_context');
   const minutes=reviewedWorkMinutes(result.events);
   return json(200,{employeeId,period:{startDate,endDate,timezone:'station_local'},status:'preview_only',
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
