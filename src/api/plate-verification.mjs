import {normalizePlate} from '../domain/plate-ocr.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPlateVerificationApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname==='/api/evidence/plate/ocr')
    return json(410,{error:'ocr_removed_use_photo_review'});
  const review=url.pathname==='/api/evidence/plate/review';
  const status=url.pathname==='/api/evidence/plate/status';
  if(!review&&!status)return json(404,{error:'not_found'});
  if(request.method!==(review?'POST':'GET'))return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
    return json(403,{error:'origin_forbidden'});
  if(review&&!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if(review&&Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
  try{
   const actor=await authenticate(token[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   if(status){
     const photoId=url.searchParams.get('photoId');
     if(!UUID.test(photoId??''))return json(400,{error:'invalid_photo'});
     const result=await db.platePhotoStatus({actorId:actor.id,photoId});
     return json(200,{result});
   }
   const text=await request.text();
   if(text.length>2048)return json(413,{error:'body_too_large'});
   let body;try{body=JSON.parse(text);}catch{return json(400,{error:'invalid_json'});}
   if(!UUID.test(body?.photoId??''))return json(400,{error:'invalid_photo'});
   if(typeof body.approved!=='boolean'||
     (body.approved&&!normalizePlate(body.observedPlate)))
     return json(400,{error:'invalid_review'});
   const result=await db.reviewPlate({
     actorId:actor.id,photoId:body.photoId,approved:body.approved,
     observedPlate:body.approved?normalizePlate(body.observedPlate):null,
   });
   return json(200,{result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='PLATE_MISMATCH')return json(409,{error:'plate_mismatch'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'evidence_not_reviewable'});
   return json(503,{error:'plate_verification_unavailable'});
  }
 };
}
