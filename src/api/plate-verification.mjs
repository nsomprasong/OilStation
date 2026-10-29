import {evaluatePlateOcr,normalizePlate} from '../domain/plate-ocr.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPlateVerificationApi({authenticate,db,recognize}){
 return async request=>{
  const url=new URL(request.url);
  const ocr=url.pathname==='/api/evidence/plate/ocr';
  const review=url.pathname==='/api/evidence/plate/review';
  if(!ocr&&!review)return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
    return json(403,{error:'origin_forbidden'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
  try{
   const actor=await authenticate(token[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   const text=await request.text();
   if(text.length>2048)return json(413,{error:'body_too_large'});
   let body;try{body=JSON.parse(text);}catch{return json(400,{error:'invalid_json'});}
   if(!UUID.test(body?.photoId??''))return json(400,{error:'invalid_photo'});
   if(review){
     if(typeof body.approved!=='boolean'||
       (body.approved&&!normalizePlate(body.observedPlate)))
       return json(400,{error:'invalid_review'});
     const result=await db.reviewPlate({
       actorId:actor.id,photoId:body.photoId,approved:body.approved,
       observedPlate:body.approved?normalizePlate(body.observedPlate):null,
     });
     return json(200,{result});
   }
   const context=await db.plateOcrContext({actorId:actor.id,photoId:body.photoId});
   // Never accept a caller-supplied storage path or expected registration.
   const photo=await db.readPlate(context.path);
   const raw=await recognize(photo);
   const verdict=evaluatePlateOcr({text:raw.text,confidence:raw.confidence,
     expectedPlate:context.expectedPlate});
   const result=await db.completePlateOcr({actorId:actor.id,photoId:body.photoId,
     observedPlate:verdict.observedPlate,accepted:verdict.verified});
   return json(200,{result,reason:verdict.reason});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'evidence_not_reviewable'});
   return json(503,{error:'plate_verification_unavailable'});
  }
 };
}
