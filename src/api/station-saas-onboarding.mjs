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
  const quote=url.pathname==='/api/station/billing/change/quote';
  const schedule=url.pathname==='/api/station/billing/change/schedule';
  const cancel=url.pathname==='/api/station/billing/change/cancel';
  if(!read&&!choose&&!quote&&!schedule&&!cancel)return json(404,{error:'not_found'});
  if(request.method!==(read?'GET':'POST'))return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!auth)return json(401,{error:'unauthenticated'});
  let body;
  if(choose||quote||schedule||cancel){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>1024)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   const exact=fields=>body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).length===fields.length&&fields.every(k=>Object.hasOwn(body,k));
   const modules=Array.isArray(body?.targetModules)&&body.targetModules.length>=1&&
    body.targetModules.length<=2&&body.targetModules.every(m=>['hr_payroll','qr_coupon'].includes(m))&&
    body.targetModules.join(',')===[...new Set(body.targetModules)].sort().join(',');
   const valid=choose?(exact(['stationId','planId','paymentMethod'])&&UUID.test(body.stationId??'')&&
      UUID.test(body.planId??'')&&['card','promptpay'].includes(body.paymentMethod)):
    (quote||schedule)?(exact(quote?['stationId','nextPlanId','paymentMethod','targetModules']:
     ['stationId','nextPlanId','paymentMethod','effectiveAt','idempotencyKey','targetModules'])&&
      UUID.test(body.stationId??'')&&UUID.test(body.nextPlanId??'')&&
      ['card','promptpay'].includes(body.paymentMethod)&&modules&&
      (quote||(typeof body.effectiveAt==='string'&&
       /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(body.effectiveAt)&&
       Number.isFinite(Date.parse(body.effectiveAt))&&
       new Date(body.effectiveAt).toISOString().slice(0,10)===body.effectiveAt.slice(0,10)&&
       typeof body.idempotencyKey==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(body.idempotencyKey)))):
     (exact(['stationId','changeId'])&&UUID.test(body.stationId??'')&&UUID.test(body.changeId??''));
   if(!valid)return json(400,{error:'invalid_plan_selection'});
  }
  const stationId=read?url.searchParams.get('stationId'):body.stationId;
  if(!UUID.test(stationId??''))return json(400,{error:'invalid_station'});
  try{
   const actor=await authenticate(auth[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   if(read)return json(200,{result:await db.stationSaasPlanOptions({
     actorId:actor.id,stationId,
   })});
   const result=quote?await db.stationSaasQuoteChange({actorId:actor.id,...body}):
    schedule?await db.stationSaasScheduleChange({actorId:actor.id,...body}):
    cancel?await db.stationSaasCancelChange({actorId:actor.id,...body}):
    await db.stationSaasSelectPlan({actorId:actor.id,...body});
   return json(200,{result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST'||e?.code==='IDEMPOTENCY_CONFLICT')
    return json(409,{error:'plan_selection_unavailable'});
   return json(503,{error:'plan_selection_unavailable'});
  }
 };
}
