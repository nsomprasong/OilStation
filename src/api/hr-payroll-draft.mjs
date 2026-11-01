// Human-reviewed salary draft; NEVER a payment, bank transfer or statutory
// calculation engine. Submitted amounts are explicit integer satang.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date=s=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?d:null;
};
const amount=(s,signed=false)=>{
 if(typeof s!=='string'||!(signed?/^-?(0|[1-9]\d{0,10})$/:/^(0|[1-9]\d{0,10})$/).test(s))
  return false;
 const n=BigInt(s);return n>=-10000000000n&&n<=10000000000n&&
  (signed||n>=0n);
};
const routes=Object.freeze({
 '/api/hr/payroll/drafts':'GET',
 '/api/hr/payroll/drafts/line':'POST',
 '/api/hr/payroll/drafts/review':'POST',
});
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPayrollDraftApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url),method=routes[url.pathname];
  if(!method)return json(404,{error:'not_found'});
  if(request.method!==method)return json(405,{error:'method_not_allowed'});
  if(method==='POST'&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  if(method==='POST'&&!(request.headers.get('content-type')||'').startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return json(401,{error:'unauthenticated'});
  let body={};
  if(method==='POST'){
   if(Number(request.headers.get('content-length'))>4096)return json(413,{error:'too_large'});
   const raw=await request.text();if(raw.length>4096)return json(413,{error:'too_large'});
   try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||typeof body!=='object'||Array.isArray(body))
    return json(400,{error:'invalid_body'});
  }
  let user;try{user=await authenticate(token);}catch{return json(401,{error:'unauthenticated'});}
  if(!UUID.test(user?.id||''))return json(401,{error:'unauthenticated'});
  try{
   if(method==='GET'){
    const stationId=url.searchParams.get('stationId');
    if(!UUID.test(stationId||''))return json(400,{error:'invalid_station'});
    const drafts=await db.hrListPayrollDrafts({actorId:user.id,stationId});
    if(!Array.isArray(drafts))throw new Error('bad_drafts');
    return json(200,{drafts,payable:false,posted:false});
   }
   if(url.pathname==='/api/hr/payroll/drafts/line'){
    const {employeeId,startDate,endDate,baseSatang,otSatang,
     otherEarningsSatang,taxSatang,socialSecuritySatang,
     otherDeductionsSatang,adjustmentSatang,basis}=body;
    const start=date(startDate),end=date(endDate);
    if(!UUID.test(employeeId||'')||!start||!end||end<=start||
       end-start>35*86400000||
       ![baseSatang,otSatang,otherEarningsSatang,taxSatang,
         socialSecuritySatang,otherDeductionsSatang].every(v=>amount(v))||
       !amount(adjustmentSatang,true)||typeof basis!=='string'||
       basis.trim().length<25||basis.length>1000)
     return json(400,{error:'invalid_payroll_draft'});
    const line=await db.hrCreatePayrollReviewLine({actorId:user.id,...body});
    return json(201,{line,payable:false,posted:false,paid:false});
   }
   if(url.pathname==='/api/hr/payroll/drafts/review'){
    if(!UUID.test(body.runId||'')||typeof body.approved!=='boolean'||
       typeof body.legalBasis!=='string'||body.legalBasis.trim().length<30||
       body.legalBasis.length>1000)
     return json(400,{error:'invalid_payroll_review'});
    const result=await db.hrReviewPayrollDraft({actorId:user.id,runId:body.runId,
     approved:body.approved,legalBasis:body.legalBasis});
    return json(200,{result,payable:false,posted:false,paid:false});
   }
  }catch(e){
   if(['FORBIDDEN','SELF_APPROVAL_FORBIDDEN'].includes(e?.code))
    return json(403,{error:'permission_denied'});
   if(['DUPLICATE_PAYROLL_LINE','PAYROLL_PERIOD_LOCKED',
        'PAYROLL_SOURCE_CHANGED','PAYROLL_EVIDENCE_UNREVIEWED'].includes(e?.code))
    return json(409,{error:e.code.toLowerCase()});
   if(['INVALID_PAYROLL_DATE','INVALID_PAYROLL_DRAFT','NEGATIVE_NET_SALARY',
        'INVALID_PAYROLL_REVIEW','EMPTY_PAYROLL','FREQUENCY_NOT_CONFIGURED'].includes(e?.code))
    return json(400,{error:'invalid_payroll_input'});
   if(['NOT_FOUND','EMPLOYEE_NOT_ELIGIBLE'].includes(e?.code))
    return json(404,{error:'not_found'});
   return json(503,{error:'payroll_review_unavailable'});
  }
  return json(404,{error:'not_found'});
 };
}
export const PAYROLL_DRAFT_ROUTES=Object.freeze(Object.keys(routes));