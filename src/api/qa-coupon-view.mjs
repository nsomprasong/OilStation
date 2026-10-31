import {qaFinanceEnabled} from './qa-topup-simulation.mjs';
import {qaScopeAllowlist} from './qa-accounts.mjs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json','cache-control':'no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
}});
export function createQaCouponViewApi({env,db}){
 return async request=>{
  if(!qaFinanceEnabled(env))return json(404,{error:'not_found'});
  const url=new URL(request.url);
  if(url.pathname!=='/api/coupon-view')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const token=url.searchParams.get('token');
  if(!token||token.length>150)return json(404,{error:'invalid_coupon'});
  const allowed=qaScopeAllowlist(env);
  if(allowed.station.length!==4||allowed.corporate_company.length!==12||
     new Set(allowed.station).size!==4||
     new Set(allowed.corporate_company).size!==12)
   return json(503,{error:'qa_scope_unavailable'});
  try{
   // Existing couponView verifies HMAC and secret hash before returning a coupon.
   const coupon=await db.couponView(token);
   if(!coupon?.id||typeof coupon.id!=='string'||
      await db.qaCouponScope({couponId:coupon.id,allowed})!==true)
    return json(404,{error:'invalid_coupon'});
   return json(200,coupon);
  }catch{return json(404,{error:'invalid_coupon'});}
 };
}
