const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[a-zA-Z0-9_-]{16,128}$/;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
const range=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function createGpsAttendanceApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/hr/attendance/gps')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
    return json(403,{error:'origin_forbidden'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!bearer)return json(401,{error:'unauthenticated'});
  if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
  try{
    const user=await authenticate(bearer[1]);
    if(!user?.id||!UUID.test(user.id))return json(401,{error:'unauthenticated'});
    const raw=await request.text();
    if(raw.length>2048)return json(413,{error:'body_too_large'});
    let data;try{data=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
    if(!UUID.test(data?.stationId??'')||
       !['clock_in','clock_out','break_start','break_end'].includes(data?.eventType)||
       !KEY.test(data?.idempotencyKey??'')||
       !range(data?.latitude,-90,90)||!range(data?.longitude,-180,180)||
       !range(data?.accuracyMeters,0,1000))
      return json(400,{error:'invalid_attendance'});
    const attendance=await db.hrRecordGps({actorId:user.id,stationId:data.stationId,
      eventType:data.eventType,latitude:data.latitude,longitude:data.longitude,
      accuracyMeters:data.accuracyMeters,idempotencyKey:data.idempotencyKey});
    return json(202,{attendance});
  }catch(e){
    if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
    if(['INVALID_REQUEST','IDEMPOTENCY_CONFLICT'].includes(e?.code))
      return json(409,{error:'attendance_conflict'});
    return json(503,{error:'attendance_unavailable'});
  }
 };
}
