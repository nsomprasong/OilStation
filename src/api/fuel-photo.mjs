/** Private 5 MiB evidence intake. Neither photo nor OCR moves any money. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX=5*1024*1024;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
async function readLimited(request){
 const declared=Number(request.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>MAX)return null;
 const reader=request.body?.getReader();
 if(!reader)return null;
 const chunks=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   count+=value.byteLength;
   if(count>MAX){await reader.cancel();return null;}
   chunks.push(value);
  }
  if(count<64)return null;
  const out=new Uint8Array(count);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
 }catch{return null;}finally{reader.releaseLock();}
}
function valid(bytes,mime){
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return mime==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
}
export function createFuelPhotoApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/evidence/fuel')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!bearer)return json(401,{error:'unauthenticated'});
  const sessionId=url.searchParams.get('sessionId');
  const kind=url.searchParams.get('kind');
  if(!UUID.test(sessionId??'')||!['pump_display','receipt'].includes(kind))
   return json(400,{error:'invalid_session_or_kind'});
  const mime=(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
  if(!['image/jpeg','image/png'].includes(mime))return json(415,{error:'unsupported_image_type'});
  try{
   const user=await authenticate(bearer[1]);
   if(!user?.id||!UUID.test(user.id))return json(401,{error:'unauthenticated'});
   // DB checks station assignment and fueling status BEFORE streaming image bytes.
   const scope=await db.authorizeFuelPhoto({actorId:user.id,sessionId,kind});
   if(!UUID.test(scope?.stationId??''))throw new Error('invalid_upload_scope');
   const bytes=await readLimited(request);
   if(!bytes||!valid(bytes,mime))return json(400,{error:'invalid_image'});
   const path=await db.uploadFuelPhoto({stationId:scope.stationId,sessionId,kind,
     contentType:mime,bytes});
   const evidence=await db.recordFuelPhoto({actorId:user.id,sessionId,kind,path});
   // Do not expose a private object path to an unprivileged response.
   return json(201,{evidence:{evidenceId:evidence.evidenceId,status:'pending_ocr',verified:false}});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'session_not_fueling'});
   return json(503,{error:'fuel_evidence_unavailable'});
  }
 };
}
