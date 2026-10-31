// Authenticated corporate dispatch and driver QR inbox. Driver never chooses or
// edits the vehicle/amount, and no messaging provider is involved.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
}});
export function createDriverWorkspaceApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const list=url.pathname==='/api/corporate/drivers';
  const assign=url.pathname==='/api/corporate/driver-vehicle';
  const inbox=url.pathname==='/api/driver/coupons';
  if(!list&&!assign&&!inbox)return json(404,{error:'not_found'});
  if(request.method!==(assign?'POST':'GET'))return json(405,{error:'method_not_allowed'});
  if(assign&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  let body;
  if(assign){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>2048)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||typeof body!=='object'||Array.isArray(body)||
     Object.keys(body).sort().join(',')!=='companyId,driverUserId,plate'||
     !UUID.test(body.companyId??'')||!UUID.test(body.driverUserId??'')||
     typeof body.plate!=='string'||body.plate.trim().length<4||
     body.plate.trim().length>20)
    return json(400,{error:'invalid_assignment'});
  }
  const companyId=list?url.searchParams.get('companyId'):assign?body.companyId:null;
  if((list||assign)&&!UUID.test(companyId??''))return json(400,{error:'invalid_company'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   const memberships=(await db.memberships(actor.id)||[]).filter(x=>x.active===true);
   if(inbox){
    if(!memberships.some(m=>m.scope_type==='corporate_company'&&m.role_code==='driver'))
     return json(403,{error:'permission_denied'});
    return json(200,await db.driverCouponInbox(actor.id));
   }
   const permitted=memberships.some(m=>m.scope_type==='corporate_company'&&
    m.corporate_company_id===companyId&&
    (m.role_code==='corporate_admin'||
      (!assign&&['coupon_issuer','qr_issuer'].includes(m.role_code))||
      (!assign&&m.extra_permissions?.issue_coupon===true)));
   if(!permitted)return json(403,{error:'permission_denied'});
   if(list)return json(200,{drivers:await db.companyDriverRoster(actor.id,companyId)});
   return json(200,{assignment:await db.assignDriverVehicle({
    actorId:actor.id,companyId,driverUserId:body.driverUserId,plate:body.plate.trim(),
   })});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='VEHICLE_ALREADY_ASSIGNED'||e?.code==='ACTIVE_COUPON_REQUIRES_CANCELLATION')
    return json(409,{error:'driver_vehicle_conflict'});
   if(e?.code==='INVALID_REQUEST')return json(400,{error:'invalid_request'});
   return json(503,{error:'driver_service_unavailable'});
  }
 };
}
