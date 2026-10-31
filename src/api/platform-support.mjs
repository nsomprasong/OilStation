const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff'}});
export function createPlatformSupportApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/platform/support/overview')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  if(url.search)return json(400,{error:'invalid_request'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return json(401,{error:'unauthenticated'});
  try{
   const actor=await authenticate(token);
   if(!UUID.test(actor?.id||''))return json(401,{error:'unauthenticated'});
   const roles=await db.memberships(actor.id);
   if(!roles?.some(m=>m.scope_type==='platform'&&m.active===true&&
    ['platform_support','platform_superadmin'].includes(m.role_code)))
    return json(403,{error:'permission_denied'});
   const result=await db.platformSupportOverview({actorId:actor.id});
   if(result?.readOnly!==true)return json(503,{error:'support_read_unavailable'});
   return json(200,{result});
  }catch(e){
   return e?.code==='FORBIDDEN'?json(403,{error:'permission_denied'}):
    json(503,{error:'support_read_unavailable'});
  }
 };
}
