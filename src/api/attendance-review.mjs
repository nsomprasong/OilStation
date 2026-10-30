/** Attendance review fallback: manager decision with audit, never face verified. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store,private',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createAttendanceReviewApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const list=url.pathname==='/api/hr/attendance/pending';
  const review=url.pathname==='/api/hr/attendance/review';
  if(!list&&!review)return json(404,{error:'not_found'});
  if(request.method!==(list?'GET':'POST'))return json(405,{error:'method_not_allowed'});
  if(review&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!bearer)return json(401,{error:'unauthenticated'});
  const stationId=url.searchParams.get('stationId');
  if(list&&!UUID.test(stationId??''))return json(400,{error:'invalid_station'});
  let data;
  if(review){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>2048)return json(413,{error:'body_too_large'});
   try{data=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!data||Array.isArray(data)||typeof data!=='object'||
      Object.keys(data).length!==3||!UUID.test(data.eventId??'')
      ||typeof data.approved!=='boolean'||typeof data.reason!=='string'
      ||data.reason.trim().length<10||data.reason.length>1000)
     return json(400,{error:'invalid_attendance_review'});
  }
  try{
   const actor=await authenticate(bearer[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   if(list)return json(200,{events:await db.hrAttendancePending({actorId:actor.id,stationId})});
   const result=await db.hrReviewAttendance({
    actorId:actor.id,eventId:data.eventId,approved:data.approved,reason:data.reason.trim(),
   });
   return json(200,{result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'attendance_not_reviewable'});
   return json(503,{error:'attendance_review_unavailable'});
  }
 };
}
