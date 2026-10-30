const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX=5*1024*1024;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
function validFile(bytes,type){
 if(bytes.length<64||bytes.length>MAX)return false;
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 return false;
}
async function readLimited(request){
 const length=Number(request.headers.get('content-length'));
 if(Number.isFinite(length)&&length>MAX)return null;
 const reader=request.body?.getReader();
 if(!reader)return null;
 const chunks=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.length;if(total>MAX){await reader.cancel();return null;}
   chunks.push(value);
  }
  if(total<64)return null;
  const all=new Uint8Array(total);let offset=0;
  for(const c of chunks){all.set(c,offset);offset+=c.length;}
  return all;
 }catch{return null;}finally{reader.releaseLock();}
}
/* A bank transfer is never marked paid as a result of this upload. */
export function createTopupEvidenceApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const upload=url.pathname==='/api/evidence/topup';
  const view=url.pathname==='/api/evidence/topup-slip';
  if(!upload&&!view)return json(404,{error:'not_found'});
  if(request.method!==(upload?'POST':'GET'))return json(405,{error:'method_not_allowed'});
  if(upload&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const m=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!m)return json(401,{error:'unauthenticated'});
  const accountId=url.searchParams.get('accountId');
  const bankId=url.searchParams.get('bankId');
  const amount=url.searchParams.get('amountSatang');
  const requestId=url.searchParams.get('requestId');
  if(upload&&(!UUID.test(accountId??'')||!UUID.test(bankId??'')||
    !/^[1-9][0-9]{0,11}$/.test(amount??'')||BigInt(amount)>100000000000n||BigInt(amount)<100n))
   return json(400,{error:'invalid_topup'});
  if(view&&!UUID.test(requestId??''))return json(400,{error:'invalid_request'});
  const type=(request.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
  if(upload&&!['image/jpeg','image/png'].includes(type))
   return json(415,{error:'unsupported_image_type'});
  try{
   const actor=await authenticate(m[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   if(view){
    const result=await db.getTopupSlip({actorId:actor.id,requestId});
    return new Response(result.bytes,{status:200,headers:{
      'content-type':result.contentType==='image/png'?'image/png':'image/jpeg',
      'content-disposition':'attachment; filename="oilstation-slip.'+(result.contentType==='image/png'?'png':'jpg')+'"',
      'cache-control':'no-store, private','x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; sandbox",
      'referrer-policy':'no-referrer',
    }});
   }
   const data={actorId:actor.id,accountId,bankId,amountSatang:amount};
   await db.canUploadTopup(data);
   const bytes=await readLimited(request);
   if(!bytes||!validFile(bytes,type))return json(400,{error:'invalid_image'});
   const path=await db.uploadTopupSlip({...data,bytes,contentType:type});
   const result=await db.submitTopup({...data,path});
   return json(201,{request:{requestId:result.requestId,status:'pending',verified:false}});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST'||e?.code==='INVALID_EVIDENCE')
    return json(400,{error:'invalid_topup'});
   return json(503,{error:'topup_service_unavailable'});
  }
 };
}
