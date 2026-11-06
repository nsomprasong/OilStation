import {encryptStationBankNumber,decryptStationBankNumber} from '../domain/station-bank-crypto.mjs';
import {normalizePromptPay,buildPromptPayPayload} from '../domain/promptpay.mjs';
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
  const quote=url.pathname==='/api/topup/payment-instructions';
  const options=url.pathname==='/api/topup/amount-options';
  const stationOptions=url.pathname==='/api/station/topup/amount-options';
  if(!manage&&!details&&!quote&&!options&&!stationOptions)return json(404,{error:'not_found'});
  const posting=manage&&request.method==='POST';
  const setting=stationOptions&&request.method==='POST';
  if(!posting&&!setting&&request.method!=='GET')return json(405,{error:'method_not_allowed'});
  if((posting||setting)&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if((details||quote||posting)&&!bankEncryptionKey)return json(503,{error:'bank_service_not_configured'});
  let body=null;
  if(posting||setting){
   if(posting&&!bankEncryptionKey)return json(503,{error:'bank_service_not_configured'});
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>1024)
    return json(413,{error:'body_too_large'});
   const raw=await request.text();
   if(raw.length>1024)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(setting){
    const amounts=body?.amounts;
    if(!body||Array.isArray(body)||Object.keys(body).length!==2||
      !UUID.test(body.stationId??'')||!Array.isArray(amounts)||amounts.length<1||amounts.length>8||
      !amounts.every(x=>typeof x==='string'&&/^[1-9][0-9]{0,11}$/.test(x)&&BigInt(x)>=100n&&BigInt(x)<=100000000000n)||
      new Set(amounts).size!==amounts.length)return json(400,{error:'invalid_amount_options'});
   }else if(!body||Array.isArray(body)||Object.keys(body).length!==5||
      !['stationId','bankCode','accountName','accountNumber','isPrimary'].every(k=>Object.hasOwn(body,k))||
      !UUID.test(body.stationId??'')||
      typeof body.bankCode!=='string'||!/^[A-Z0-9_-]{2,20}$/.test(body.bankCode)||
      typeof body.accountName!=='string'||body.accountName.trim().length<2||body.accountName.length>120||
      typeof body.accountNumber!=='string'||!/^[0-9]{8,20}$/.test(body.accountNumber)||
      typeof body.isPrimary!=='boolean')return json(400,{error:'invalid_bank_account'});
  }
  const stationId=(posting||setting)?body.stationId:url.searchParams.get('stationId');
  const accountId=url.searchParams.get('accountId');
  const bankId=url.searchParams.get('bankId');
  if((manage||stationOptions)&&!UUID.test(stationId??''))return json(400,{error:'invalid_station'});
  if((details||quote)&&(!UUID.test(accountId??'')||!UUID.test(bankId??'')))
   return json(400,{error:'invalid_bank'});
  if(options&&!UUID.test(accountId??''))return json(400,{error:'invalid_account'});
  const amount=url.searchParams.get('amountSatang');
  if(quote&&(!/^[1-9][0-9]{0,11}$/.test(amount??'')||BigInt(amount)<100n||BigInt(amount)>100000000000n))
   return json(400,{error:'invalid_amount'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??''))return json(401,{error:'unauthenticated'});
   if(options)return json(200,{amounts:await db.corporateTopupAmountOptions({actorId:actor.id,accountId})});
   if(stationOptions){
    if(setting)return json(200,await db.stationSetTopupAmountOptions({actorId:actor.id,stationId,amounts:body.amounts}));
    return json(200,{amounts:await db.stationGetTopupAmountOptions({actorId:actor.id,stationId})});
   }
   if(quote){
    await db.canUploadTopup({actorId:actor.id,accountId,bankId,amountSatang:amount});
    const bank=await db.corporateTopupBankTransferDetails({actorId:actor.id,accountId,bankId});
    const recipient=await decryptStationBankNumber(bank.encryptedNumber,bankEncryptionKey);
    const promptpay=bank.bankCode==='PROMPTPAY';
    const payment={id:bank.id,bankCode:bank.bankCode,accountName:bank.accountName,amountSatang:amount,
     method:promptpay?'promptpay':'bank_transfer'};
    if(promptpay){
     const type=recipient.length===10?'promptpay_phone':'promptpay_national_id';
     payment.qrPayload=buildPromptPayPayload({type,recipient,amountSatang:Number(amount)});
    }else payment.accountNumber=recipient;
    return json(200,{payment});
   }
   if(details){
    const secured=await db.corporateTopupBankTransferDetails({actorId:actor.id,accountId,bankId});
    const number=await decryptStationBankNumber(secured.encryptedNumber,bankEncryptionKey);
    return json(200,{bank:{id:secured.id,bankCode:secured.bankCode,
     accountName:secured.accountName,accountNumber:number}});
   }
   if(!posting)return json(200,{banks:await db.stationTopupBankProfiles({
    actorId:actor.id,stationId})});
   if(body.bankCode==='PROMPTPAY'){
    try{normalizePromptPay(body.accountNumber.length===10?'promptpay_phone':'promptpay_national_id',body.accountNumber);}
    catch{return json(400,{error:'invalid_promptpay_recipient'});}
   }
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
