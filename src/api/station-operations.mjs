// Permission-scoped operational read views. No direct credit mutation or
// deletion of Auth users; member changes are audited, reversible deactivation.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const STATION_OPERATIONS_ROUTES=Object.freeze([
 '/api/station/customer-overview','/api/fuel/report',
 '/api/members/directory','/api/members/change',
]);
const reply=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'},
});
export function createStationOperationsApi({authenticate,db}){
 return async function handle(request){
  const url=new URL(request.url),path=url.pathname;
  if(!STATION_OPERATIONS_ROUTES.includes(path))return reply(404,{error:'not_found'});
  if(request.method!==(path==='/api/members/change'?'POST':'GET'))
   return reply(405,{error:'method_not_allowed'});
  if(request.method==='POST'){
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)return reply(403,{error:'origin_forbidden'});
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return reply(415,{error:'unsupported_media_type'});
  }
  const token=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return reply(401,{error:'unauthenticated'});
  try{
   const actor=await authenticate(token);
   if(!UUID.test(actor?.id||''))return reply(401,{error:'unauthenticated'});
   if(path==='/api/station/customer-overview'){
    const stationId=url.searchParams.get('stationId');
    if(!UUID.test(stationId||''))return reply(400,{error:'invalid_station'});
    return reply(200,{accounts:await db.stationCustomerOverview(actor.id,stationId)});
   }
   if(path==='/api/fuel/report'){
    const stationId=url.searchParams.get('stationId'),companyId=url.searchParams.get('companyId');
    const plate=(url.searchParams.get('plate')||'').trim();
    if(!UUID.test(stationId||'')||(companyId&&!UUID.test(companyId))
       ||plate.length>40)return reply(400,{error:'invalid_report_filter'});
    return reply(200,{rows:await db.stationFuelPlateReport({
     actorId:actor.id,stationId,companyId:companyId||null,plate:plate||null,limit:100,
    })});
   }
   if(path==='/api/members/directory'){
    const scopeType=url.searchParams.get('scopeType'),scopeId=url.searchParams.get('scopeId');
    if(!['station','corporate_company'].includes(scopeType)||!UUID.test(scopeId||''))
     return reply(400,{error:'invalid_scope'});
    return reply(200,{members:await db.memberDirectory({
     actorId:actor.id,scopeType,scopeId,
    })});
   }
   const contentLength=Number(request.headers.get('content-length')||0);
   if(contentLength>2048)return reply(413,{error:'too_large'});
   const body=await request.json().catch(()=>null);
   if(!body||!UUID.test(body.membershipId||'')||
      !['edit','deactivate'].includes(body.action)||
      (body.action==='edit'&&(!/^[a-z_]{2,32}$/.test(body.roleCode||'')))||
      (body.action==='deactivate'&&body.confirm!==true))
    return reply(400,{error:'invalid_member_change'});
   return reply(200,{result:await db.memberChange({
    actorId:actor.id,membershipId:body.membershipId,
    action:body.action,roleCode:body.action==='edit'?body.roleCode:null,
   })});
  }catch(error){
   // Do not leak tenant IDs, auth records or SQL errors in public responses.
   if(['FORBIDDEN','PROTECTED_ROLE'].includes(error?.code)||/FORBIDDEN|PROTECTED_ROLE/.test(error?.message||''))
    return reply(403,{error:'permission_denied'});
   if(/DRIVER_HAS_ACTIVE_COUPON/.test(error?.message||''))
    return reply(409,{error:'driver_has_active_coupon'});
   if(/INVALID_ROLE|INVALID_ACTION/.test(error?.message||''))
    return reply(400,{error:'invalid_member_change'});
   return reply(503,{error:'service_unavailable'});
  }
 };
}
