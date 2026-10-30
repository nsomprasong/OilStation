/** Start using only DB-attested photo UUID; no untrusted price/plate/path. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
}});
export function createFuelStartApi({authenticate,db}){
 return async request=>{
  if(new URL(request.url).pathname!=='/api/fuel/start')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)
   return json(403,{error:'origin_forbidden'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if(Number(request.headers.get('content-length'))>1024)return json(413,{error:'body_too_large'});
  try{
   const actor=await authenticate(token[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||Array.isArray(body)||Object.keys(body).length!==1||
      !UUID.test(body.photoId??''))return json(400,{error:'invalid_evidence'});
   return json(200,{session:await db.beginVerifiedFueling({actorId:actor.id,photoId:body.photoId})});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(['INVALID_REQUEST','PLATE_MISMATCH'].includes(e?.code))
     return json(409,{error:'plate_verification_required'});
   return json(503,{error:'fuel_start_unavailable'});
  }
 };
}
