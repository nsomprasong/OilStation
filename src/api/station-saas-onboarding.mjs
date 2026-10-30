/** Invitation-first SaaS onboarding.
 * Owner can select a saved platform plan and a payment method.
 * This stage records an intent; NO money movement or active subscription.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createStationSaasOnboardingApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const read=url.pathname==='/api/station/billing/options';
  const choose=url.pathname==='/api/station/billing/select';
  if(!read&&!choose)return json(404,{error:'not_found'});
  if(request.method!==(read?'GET':'POST'))return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!auth)return json(401,{error:'unauthenticated'});
  let body;
  if(choose){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>1024)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||Array.isArray(body)||Object.keys(body).length!==3||
     !UUID.test(body.stationId??'')||!UUID.test(body.planId??'')||
     !['card','promptpay'].includes(body.paymentMethod))
    return json(400,{error:'invalid_plan_selection'});
  }
  const stationId=read?url.searchParams.get('stationId'):body.stationId;
  if(!UUID.test(stationId??''))return json(400,{error:'invalid_station'});
  try{
   const actor=await authenticate(auth[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   if(read)return json(200,{result:await db.stationSaasPlanOptions({
     actorId:actor.id,stationId,
   })});
   const result=await db.stationSaasSelectPlan({actorId:actor.id,...body});
   return json(200,{result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'plan_selection_unavailable'});
   return json(503,{error:'plan_selection_unavailable'});
  }
 };
}
