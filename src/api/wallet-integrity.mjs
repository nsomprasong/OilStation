/** Explicitly read-only wallet integrity; never performs a financial update. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
}});
export function createWalletIntegrityApi({authenticate,db}){
 return async request=>{
  const u=new URL(request.url);
  if(u.pathname!=='/api/corporate/wallet-integrity')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  const accountId=u.searchParams.get('accountId');
  if(!UUID.test(accountId??''))return json(400,{error:'invalid_account'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   const integrity=await db.walletIntegrity({actorId:actor.id,accountId});
   if(!integrity||integrity.readOnly!==true||integrity.bankReconciled!==false)
    throw new Error('unsafe_integrity_context');
   return json(200,{integrity});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='NOT_FOUND')return json(404,{error:'not_found'});
   return json(503,{error:'wallet_integrity_unavailable'});
  }
 };
}
