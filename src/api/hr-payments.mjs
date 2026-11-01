import {buildPromptPayPayload,normalizePromptPay,maskManualAccount} from '../domain/promptpay.mjs';
import {planAdvanceInstallments} from '../domain/advance-installments.mjs';
import {reviewAdvanceDeductions} from '../domain/advance-payroll-readiness.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const methods={
 '/api/hr/payees':'GET','/api/hr/payees/register':'POST',
 '/api/hr/payees/review':'POST','/api/hr/payees/instruction':'POST',
 '/api/hr/advances':'GET','/api/hr/advances/period-preview':'GET',
 '/api/hr/advances/request':'POST',
 '/api/hr/advances/review':'POST',
};
const respond=(status,data)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer'},
});
const deny=(status,error)=>respond(status,{error});
const satang=value=>typeof value==='string'&&/^[1-9][0-9]{0,11}$/.test(value)&&
 Number.isSafeInteger(Number(value))?Number(value):null;
export function createHrPaymentApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url),path=url.pathname;
  if(!methods[path])return deny(404,'not_found');
  if(request.method!==methods[path])return deny(405,'method_not_allowed');
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)
   return deny(403,'origin_forbidden');
  if(request.method==='POST'&&
     !(request.headers.get('content-type')||'').startsWith('application/json'))
   return deny(415,'unsupported_media_type');
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!auth)return deny(401,'unauthenticated');
  let body={};
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length'))>2048)return deny(413,'body_too_large');
   const raw=await request.text();
   if(raw.length>2048)return deny(413,'body_too_large');
   try{body=JSON.parse(raw);}catch{return deny(400,'invalid_json');}
   if(!body||Array.isArray(body)||typeof body!=='object')return deny(400,'invalid_body');
  }
  let user;
  try{user=await authenticate(auth);}catch{return deny(401,'unauthenticated');}
  if(!UUID.test(user?.id??''))return deny(401,'unauthenticated');
  try{
   if(path==='/api/hr/payees'||path==='/api/hr/advances'){
    const employeeId=url.searchParams.get('employeeId');
    if(!UUID.test(employeeId??''))return deny(400,'invalid_employee');
    const data=path==='/api/hr/payees'?
      await db.hrListPayees({actorId:user.id,employeeId}):
      await db.hrListAdvances({actorId:user.id,employeeId});
    return respond(200,{items:data});
   }
   if(path==='/api/hr/advances/period-preview'){
    const employeeId=url.searchParams.get('employeeId');
    const startDate=url.searchParams.get('startDate');
    const endDate=url.searchParams.get('endDate');
    if(!UUID.test(employeeId??'')||!DATE.test(startDate??'')||!DATE.test(endDate??''))
     return deny(400,'invalid_period');
    const data=await db.hrListAdvances({actorId:user.id,employeeId});
    const items=(data||[]).map(advance=>reviewAdvanceDeductions(advance,{startDate,endDate}));
    const proposedSatang=items.reduce((sum,x)=>sum+x.plannedInPeriodSatang,0);
    return respond(200,{items,proposedSatang,postedSatang:0,deductibleSatang:0,
      payable:false,readOnly:true,needsExternalVerification:true});
   }
   if(path==='/api/hr/payees/register'){
    if(!UUID.test(body.employeeId??''))return deny(400,'invalid_employee');
    let normalized;
    if(body.type==='bank_account'){
     const masked=maskManualAccount(body.type,body.reference);
     if(!/^[A-Z0-9]{2,10}$/.test(body.bankCode||''))return deny(400,'invalid_bank_code');
     normalized={reference:body.reference.replace(/[ -]/g,''),masked};
    }else{
     const pp=normalizePromptPay(body.type,body.reference);
     normalized={reference:body.reference.replace(/[ -]/g,''),masked:pp.masked};
    }
    const saved=await db.hrRegisterPayee({actorId:user.id,employeeId:body.employeeId,
     type:body.type,reference:normalized.reference,
     bankCode:body.type==='bank_account'?body.bankCode:null});
    return respond(201,{payee:saved});
   }
   if(path==='/api/hr/payees/review'){
    if(!UUID.test(body.methodId??'')||typeof body.approved!=='boolean')
     return deny(400,'invalid_review');
    if(body.approved&&(typeof body.verifiedName!=='string'||
      body.verifiedName.trim().length<2||body.verifiedName.length>120))
     return deny(400,'verified_recipient_required');
    const result=await db.hrReviewPayee({actorId:user.id,methodId:body.methodId,
     approved:body.approved,verifiedName:body.approved?body.verifiedName.trim():null});
    return respond(200,{result});
   }
   if(path==='/api/hr/payees/instruction'){
    if(!UUID.test(body.methodId??''))return deny(400,'invalid_method');
    const amount=satang(body.amountSatang);
    if(amount===null)return deny(400,'invalid_amount');
    const p=await db.hrRevealPayee({actorId:user.id,methodId:body.methodId});
    if(p.status!=='instruction_only')return deny(409,'payee_not_approved');
    if(p.type==='bank_account')return respond(200,{
     kind:'manual_bank',bankCode:p.bankCode,bankAccount:p.reference,
     recipientName:p.verifiedName,amountSatang:amount,
     instructionOnly:true,paid:false,requiresBankConfirmation:true,
    });
    const payload=buildPromptPayPayload({type:p.type,recipient:p.reference,amountSatang:amount});
    return respond(200,{kind:'promptpay',payload,recipientName:p.verifiedName,
      masked:p.masked,amountSatang:amount,instructionOnly:true,paid:false,
      requiresBankConfirmation:true});
   }
   if(path==='/api/hr/advances/request'){
    if(!UUID.test(body.employeeId??'')||!DATE.test(body.firstDeductionDate??''))
     return deny(400,'invalid_advance');
    const amount=satang(body.amountSatang);
    if(amount===null||!Number.isInteger(body.installments)||body.installments<1||
       body.installments>24)return deny(400,'invalid_advance');
    const saved=await db.hrRequestAdvance({actorId:user.id,employeeId:body.employeeId,
     amountSatang:String(amount),installments:body.installments,
     firstDeductionDate:body.firstDeductionDate});
    const schedule=planAdvanceInstallments({principalSatang:amount,
     installments:body.installments,firstDeductionDate:body.firstDeductionDate,
     frequency:saved.frequency});
    return respond(201,{advance:saved,previewOnly:true,deducted:false,schedule});
   }
   if(path==='/api/hr/advances/review'){
    if(!UUID.test(body.advanceId??'')||typeof body.approved!=='boolean')
     return deny(400,'invalid_review');
    const result=await db.hrReviewAdvance({actorId:user.id,advanceId:body.advanceId,
     approved:body.approved});
    return respond(200,{result,disbursed:false,deducted:false});
   }
  }catch(e){
   if(e?.code==='FORBIDDEN'||e?.code==='SELF_APPROVAL_FORBIDDEN')return deny(403,'permission_denied');
   if(e instanceof RangeError||e instanceof TypeError)return deny(400,'invalid_request');
   if(['INVALID_REQUEST','INVALID_PAYEE','INVALID_ADVANCE_PLAN','INVALID_PAYROLL_DATE'].includes(e?.code))
    return deny(400,'invalid_request');
   if(['DUPLICATE_PENDING_PAYEE','PENDING_ADVANCE_EXISTS'].includes(e?.code))
    return deny(409,'already_pending');
   return deny(503,'hr_payment_unavailable');
  }
  return deny(404,'not_found');
 };
}
export const HR_PAYMENT_ROUTES=Object.freeze(Object.keys(methods));
