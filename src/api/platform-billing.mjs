/** Explicit platform-only billing setup; amounts always originate from saved plan. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const MONEY=/^(?:0|[1-9]\d{0,7})$/;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
const exact=(obj,fields)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===fields.length&&fields.every(k=>Object.hasOwn(obj,k));
function isDate(value){if(typeof value!=='string'||!DATE.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&
 d.toISOString().slice(0,10)===value;}
const code=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{2,39}$/.test(v);
const name=v=>typeof v==='string'&&v.trim().length>=2&&v.trim().length<=120;
const time=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
const routes={
 '/api/platform/billing/overview':'GET',
 '/api/platform/billing/flat-plan':'POST',
 '/api/platform/billing/bundle-plan':'POST',
 '/api/platform/billing/archive-plan':'POST',
 '/api/platform/billing/tax':'POST',
 '/api/platform/billing/group':'POST',
 '/api/platform/billing/subscription':'POST',
 '/api/platform/billing/draft':'POST',
 '/api/platform/billing/issue':'POST',
};
function valid(path,d){
 switch(path){
 case '/api/platform/billing/bundle-plan':
  return exact(d,['code','name','frequency','couponPriceSatang','hrPriceSatang','bundlePriceSatang','effectiveOn'])&&
    code(d.code)&&name(d.name)&&
    ['monthly','yearly'].includes(d.frequency)&&MONEY.test(d.couponPriceSatang)&&
    MONEY.test(d.hrPriceSatang)&&MONEY.test(d.bundlePriceSatang)&&
    BigInt(d.bundlePriceSatang)>=1000n&&BigInt(d.bundlePriceSatang)<=99999999n&&
    isDate(d.effectiveOn);
 case '/api/platform/billing/archive-plan':
  return exact(d,['planId'])&&UUID.test(d.planId);
 case '/api/platform/billing/flat-plan':
  return exact(d,['code','name','frequency','couponPriceSatang','hrPriceSatang','effectiveOn'])&&
    code(d.code)&&name(d.name)&&
    ['monthly','yearly'].includes(d.frequency)&&MONEY.test(d.couponPriceSatang)&&
    MONEY.test(d.hrPriceSatang)&&isDate(d.effectiveOn);
 case '/api/platform/billing/tax':
  return exact(d,['vatMode','rateBasisPoints','effectiveOn'])&&
   ['inclusive','exclusive'].includes(d.vatMode)&&Number.isInteger(d.rateBasisPoints)&&
   d.rateBasisPoints>=0&&d.rateBasisPoints<=10000&&isDate(d.effectiveOn);
 case '/api/platform/billing/group':
  return exact(d,['organizationId','name','stationIds'])&&UUID.test(d.organizationId)&&name(d.name)&&
   Array.isArray(d.stationIds)&&d.stationIds.length>=1&&d.stationIds.length<=50&&
   d.stationIds.every(x=>UUID.test(x))&&new Set(d.stationIds).size===d.stationIds.length;
 case '/api/platform/billing/subscription':
  return exact(d,['stationId','planId','startsAt','periodEnd'])&&
   UUID.test(d.stationId)&&UUID.test(d.planId)&&time(d.startsAt)&&time(d.periodEnd)&&
   Date.parse(d.periodEnd)>Date.parse(d.startsAt);
 case '/api/platform/billing/draft':
  return exact(d,['billingGroupId','paymentMethod','periodStart','periodEnd'])&&
   UUID.test(d.billingGroupId)&&['card','promptpay'].includes(d.paymentMethod)&&
   isDate(d.periodStart)&&isDate(d.periodEnd)&&d.periodStart<d.periodEnd;
 case '/api/platform/billing/issue':
  return exact(d,['invoiceId'])&&UUID.test(d.invoiceId);
 default:return false;
 }
}
export function createPlatformBillingApi({authenticate,db}){
 return async request=>{
  const path=new URL(request.url).pathname;
  if(!Object.hasOwn(routes,path))return json(404,{error:'not_found'});
  if(request.method!==routes[path])return json(405,{error:'method_not_allowed'});
  if(request.method==='POST'&&request.headers.get('origin')&&
    request.headers.get('origin')!==new URL(request.url).origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  let data=null;
  if(request.method==='POST'){
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>4096)return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>4096)return json(413,{error:'body_too_large'});
   try{data=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!valid(path,data))return json(400,{error:'invalid_platform_billing'});
  }
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   let result;
   switch(path){
    case '/api/platform/billing/overview':
     result=await db.platformSaasBillingOverview({actorId:actor.id});break;
    case '/api/platform/billing/flat-plan':
     result=await db.platformSaasDefinePlan({actorId:actor.id,...data});break;
    case '/api/platform/billing/bundle-plan':
     result=await db.platformSaasDefineBundlePlan({actorId:actor.id,...data});break;
    case '/api/platform/billing/archive-plan':
     result=await db.platformSaasArchivePlan({actorId:actor.id,...data});break;
    case '/api/platform/billing/tax':
     result=await db.platformSaasTaxPolicy({actorId:actor.id,...data});break;
    case '/api/platform/billing/group':
     result=await db.platformSaasGroup({actorId:actor.id,...data});break;
    case '/api/platform/billing/subscription':
     result=await db.platformSaasSubscription({actorId:actor.id,...data});break;
    case '/api/platform/billing/draft':
     result=await db.platformSaasDraftInvoice({actorId:actor.id,...data});break;
    case '/api/platform/billing/issue':
     result=await db.platformSaasIssueInvoice({actorId:actor.id,...data});break;
    default:return json(404,{error:'not_found'});
   }
   return json(200,{result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='PLAN_IN_USE')return json(409,{error:'plan_in_use'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'billing_configuration_unavailable'});
   return json(503,{error:'billing_configuration_unavailable'});
  }
 };
}
