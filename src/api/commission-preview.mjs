import {previewCollectedCommission} from '../domain/commission-preview.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createCommissionPreviewApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/platform/billing/commission-preview')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!bearer)return json(401,{error:'unauthenticated'});
  const invoiceLineId=url.searchParams.get('invoiceLineId');
  if(!UUID.test(invoiceLineId??''))return json(400,{error:'invalid_invoice_line'});
  try{
   const actor=await authenticate(bearer[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   const context=await db.platformPaidSaasCommissionContext({actorId:actor.id,invoiceLineId});
   const preview=previewCollectedCommission(context);
   return json(200,{preview,invoiceLineId});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'invoice_not_collected'});
   return json(409,{error:'commission_requires_review'});
  }
 };
}
