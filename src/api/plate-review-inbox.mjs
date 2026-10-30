const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPlateReviewInboxApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const list=url.pathname==='/api/evidence/plate/reviews';
  const photo=url.pathname==='/api/evidence/plate/photo';
  if(!list&&!photo)return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!match)return json(401,{error:'unauthenticated'});
  const id=url.searchParams.get(list?'stationId':'photoId');
  if(!UUID.test(id??''))return json(400,{error:'invalid_request'});
  try{
   const user=await authenticate(match[1]);
   if(!user?.id||!UUID.test(user.id))return json(401,{error:'unauthenticated'});
   if(list){
    const reviews=await db.stationPlateReviewInbox({actorId:user.id,stationId:id});
    return json(200,{reviews});
   }
   const access=await db.platePhotoAccess({actorId:user.id,photoId:id});
   const result=await db.readPlate(access.path);
   return new Response(result.bytes,{status:200,headers:{
    'content-type':result.contentType==='image/png'?'image/png':'image/jpeg',
    'cache-control':'private, no-store','content-disposition':'inline',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; sandbox",
   }});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(404,{error:'photo_not_found'});
   return json(503,{error:'plate_photo_unavailable'});
  }
 };
}
