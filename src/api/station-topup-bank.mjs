import {encryptStationBankNumber,decryptStationBankNumber} from '../domain/station-bank-crypto.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createStationBankApi({authenticate,db,bankEncryptionKey}){
 return async request=>{
  const url=new URL(request.url);
  const manage=url.pathname==='/api/station/topup/banks';
  const details=url.pathname==='/api/topup/bank-details';
  if(!manage&&!details)return json(404,{error:'not_found'});
  const posting=manage&&request.method==='POST';
  if(!posting&&request.method!=='GET')return json(405,{error:'method_not_allowed'});
  if(posting&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if(!manage&&!bankEncryptionKey)return json(503,{error:'bank_service_not_configured'});
  let body=null;
  if(posting){
   if(!bankEncryptionKey)return json(503,{error:'bank_service_not_configured'});
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>1024)
    return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||Array.isArray(body)||Object.keys(body).length!==5||
      !['stationId','bankCode','accountName','accountNumber','isPrimary'].every(k=>Object.hasOwn(body,k))||
      !UUID.test(body.stationId??'')||
      typeof body.bankCode!=='string'||!/^[A-Z0-9_-]{2,20}$/.test(body.bankCode)||
      typeof body.accountName!=='string'||body.accountName.trim().length<2||body.accountName.length>120||
      typeof body.accountNumber!=='string'||!/^[0-9]{8,20}$/.test(body.accountNumber)||
      typeof body.isPrimary!=='boolean')return json(400,{error:'invalid_bank_account'});
  }
  const stationId=posting?body.stationId:url.searchParams.get('stationId');
  const accountId=url.searchParams.get('accountId');
  const bankId=url.searchParams.get('bankId');
  if(manage&&!UUID.test(stationId??''))return json(400,{error:'invalid_station'});
  if(details&&(!UUID.test(accountId??'')||!UUID.test(bankId??'')))
   return json(400,{error:'invalid_bank'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   if(details){
    const secured=await db.corporateTopupBankTransferDetails({actorId:actor.id,accountId,bankId});
    const number=await decryptStationBankNumber(secured.encryptedNumber,bankEncryptionKey);
    return json(200,{bank:{id:secured.id,bankCode:secured.bankCode,
     accountName:secured.accountName,accountNumber:number}});
   }
   if(!posting)return json(200,{banks:await db.stationTopupBankProfiles({
    actorId:actor.id,stationId})});
   // Never forward or log plaintext to the SQL ledger.
   const encrypted=await encryptStationBankNumber(body.accountNumber,bankEncryptionKey);
   const result=await db.stationRegisterTopupBank({
    actorId:actor.id,stationId,bankCode:body.bankCode,
    accountName:body.accountName.trim(),isPrimary:body.isPrimary,
    encryptedNumber:encrypted.ciphertext,maskedNumber:encrypted.masked,
   });
   return json(201,{bank:result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='NOT_FOUND')return json(404,{error:'not_found'});
   if(e?.code==='INVALID_REQUEST')return json(409,{error:'bank_registration_conflict'});
   return json(503,{error:'bank_service_unavailable'});
  }
 };
}
