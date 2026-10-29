const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
}});
export function createBillingInvoiceApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/billing/invoices')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  const organizationId=url.searchParams.get('organizationId');
  if(!UUID.test(organizationId??''))return json(400,{error:'invalid_organization'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   const invoices=await db.listSaasInvoices({actorId:actor.id,organizationId});
   return json(200,{invoices});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   return json(503,{error:'billing_invoices_unavailable'});
  }
 };
}
