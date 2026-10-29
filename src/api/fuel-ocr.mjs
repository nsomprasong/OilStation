import {parseFuelOcrPreview} from '../domain/fuel-ocr.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createFuelOcrApi({authenticate,db,recognize}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/evidence/fuel/ocr')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!match)return json(401,{error:'unauthenticated'});
  if(Number(request.headers.get('content-length'))>1024)return json(413,{error:'body_too_large'});
  try{
   const actor=await authenticate(match[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   let data;try{data=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!data||Array.isArray(data)||Object.keys(data).length!==1||
      !UUID.test(data.evidenceId??''))
    return json(400,{error:'invalid_evidence'});
   // The DB returns a trusted path and kind AFTER station membership verification.
   const scope=await db.fuelOcrContext({actorId:actor.id,evidenceId:data.evidenceId});
   const photo=await db.readFuelPhoto(scope.path);
   const rawOcr=await recognize(photo);
   const preview=parseFuelOcrPreview({kind:scope.kind,text:rawOcr.text,
      confidence:rawOcr.confidence});
   const result=await db.recordFuelOcr({actorId:actor.id,evidenceId:data.evidenceId,
     preview});
   return json(200,{preview:{...preview,status:'needs_human_review',verified:false},
     evidenceId:result.evidenceId});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'evidence_not_reviewable'});
   return json(503,{error:'fuel_ocr_unavailable'});
  }
 };
}
