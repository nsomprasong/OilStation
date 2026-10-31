/** Platform Sales only. Database RPC enforces role as a second boundary. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPlatformSalesApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const viewing=url.pathname==='/api/platform/sales/workspace';
  const moving=url.pathname==='/api/platform/sales/transfer';
  const inspection=url.pathname==='/api/platform/sales/inspection';
  const activity=url.pathname==='/api/platform/sales/activity';
  if(!viewing&&!moving&&!inspection&&!activity)return json(404,{error:'not_found'});
  if(request.method!==(moving?'POST':'GET'))return json(405,{error:'method_not_allowed'});
  if(moving&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!bearer)return json(401,{error:'unauthenticated'});
  const stationId=url.searchParams.get('stationId');
  const companyId=url.searchParams.get('companyId');
  const before=url.searchParams.get('before');
  if(inspection||activity){
   const validKeys=inspection?['stationId','companyId']:['stationId','before'];
   if(!UUID.test(stationId??'')||url.searchParams.size>validKeys.length||
    [...url.searchParams.keys()].some(k=>!validKeys.includes(k)))return json(400,{error:'invalid_inspection'});
   if(inspection&&companyId!==null&&!UUID.test(companyId))return json(400,{error:'invalid_inspection'});
   if(activity&&before!==null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(before)||
     !Number.isFinite(Date.parse(before))||new Date(before).toISOString()!==before))
     return json(400,{error:'invalid_inspection'});
  }
  let body;
  if(moving){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>2048)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw)}catch{return json(400,{error:'invalid_json'})}
   if(!body||Array.isArray(body)||typeof body!=='object'||
    Object.keys(body).sort().join(',')!=='reason,salesUserId,stationId'||
    !UUID.test(body.stationId??'')||!UUID.test(body.salesUserId??'')||
    typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.trim().length>300)
    return json(400,{error:'invalid_sales_transfer'});
  }
  try{
   const actor=await authenticate(bearer[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   const result=viewing?await db.platformSalesWorkspace({actorId:actor.id}):
    inspection?await db.platformSalesInspection({actorId:actor.id,stationId,companyId}):
    activity?await db.platformSalesActivity({actorId:actor.id,stationId,before}):
    await db.platformSalesTransfer({actorId:actor.id,...body,reason:body.reason.trim()});
   return json(200,{result});
  }catch(error){
   if(error?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(error?.code==='TRANSFER_ALREADY_SCHEDULED')return json(409,{error:'transfer_already_scheduled'});
   if(error?.code==='INVALID_REQUEST')return json(409,{error:'invalid_sales_transfer'});
   return json(503,{error:'sales_workspace_unavailable'});
  }
 };
}
