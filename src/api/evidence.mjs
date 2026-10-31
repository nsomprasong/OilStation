const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES=5*1024*1024;
const MIN_BYTES=64;
function json(status,body) {
 return new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff',
 }});
}
function isImage(bytes,type) {
 if(type==='image/jpeg')return bytes.length>=MIN_BYTES&&bytes[0]===0xff&&
   bytes[1]===0xd8&&bytes[2]===0xff;
 if(type==='image/png')return bytes.length>=MIN_BYTES&&
   [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 return false;
}
async function limitedBytes(request) {
 const size=Number(request.headers.get('content-length'));
 if(Number.isFinite(size)&&size>MAX_BYTES)return null;
 const reader=request.body?.getReader();
 if(!reader)return null;
 const chunks=[];let length=0;
 try {
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>MAX_BYTES){await reader.cancel();return null;}
   chunks.push(value);
  }
  if(length<MIN_BYTES)return null;
  const out=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
 }catch{return null;}
 finally{reader.releaseLock();}
}
/** Upload original plate photo; only a different authorized reviewer can approve it. */
export function createEvidenceApi({authenticate,db}) {
 return async function handle(request) {
  const url=new URL(request.url);
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  const stationId=url.searchParams.get('stationId');
  const couponId=url.searchParams.get('couponId');
  if(!UUID.test(stationId||'')||!UUID.test(couponId||''))
   return json(400,{error:'invalid_coupon_or_station'});
  const type=(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
  if(type!=='image/jpeg'&&type!=='image/png')
   return json(415,{error:'unsupported_image_type'});
  try{
   const user=await authenticate(token[1]);
   if(!user?.id||!UUID.test(user.id))return json(401,{error:'unauthenticated'});
   // Call database authorization BEFORE reading potentially large image bytes.
   await db.canUploadPlate({actorId:user.id,stationId,couponId});
   const bytes=await limitedBytes(request);
   if(!bytes||!isImage(bytes,type))return json(400,{error:'invalid_image'});
   const path=await db.uploadPlate({stationId,couponId,bytes,contentType:type});
   const record=await db.recordPlate({
    actorId:user.id,stationId,couponId,path,
   });
   return json(201,{evidence:{photoId:record.photoId,path,status:'pending_review',verified:false}});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(400,{error:'invalid_evidence'});
   return json(503,{error:'evidence_service_unavailable'});
  }
 };
}
