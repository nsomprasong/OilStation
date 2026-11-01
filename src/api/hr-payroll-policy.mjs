// Configurable payroll policy is not statutory advice, payroll approval or payment.
// Two different station management identities must propose and attest each policy.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const isDate=s=>{
 if(typeof s!=='string'||!DATE.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
};
const routes=Object.freeze({
 '/api/hr/payroll/policies':'GET',
 '/api/hr/payroll/policies/propose':'POST',
 '/api/hr/payroll/policies/review':'POST',
});
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
}});
export function createPayrollPolicyApi({authenticate,db}){
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
    const items=await db.hrListPayrollPolicies({actorId:user.id,stationId});
    if(!Array.isArray(items))throw new Error('invalid_database_reply');
    return json(200,{items,payable:false,payrollAutoApproved:false});
   }
   if(url.pathname==='/api/hr/payroll/policies/propose'){
    const {stationId,effectiveFrom,monthlyDivisorDays,normalDayMinutes,
     overtimeRateBps,annualLeaveDays,sickLeaveDays,personalLeaveDays,
     paidAnnual,paidSick,paidPersonal,policyBasis}=body;
    const validInt=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
    if(!UUID.test(stationId||'')||!isDate(effectiveFrom)||
       !validInt(monthlyDivisorDays,1,31)||!validInt(normalDayMinutes,240,720)||
       !validInt(overtimeRateBps,10000,40000)||
       !validInt(annualLeaveDays,0,366)||!validInt(sickLeaveDays,0,366)||
       !validInt(personalLeaveDays,0,366)||
       [paidAnnual,paidSick,paidPersonal].some(v=>typeof v!=='boolean')||
       typeof policyBasis!=='string'||policyBasis.trim().length<20||
       policyBasis.length>1000)return json(400,{error:'invalid_payroll_policy'});
    const policy=await db.hrProposePayrollPolicy({actorId:user.id,...body});
    return json(201,{policy,payable:false,payrollAutoApproved:false});
   }
   if(url.pathname==='/api/hr/payroll/policies/review'){
    if(!UUID.test(body.policyId||'')||typeof body.approved!=='boolean')
     return json(400,{error:'invalid_review'});
    const policy=await db.hrReviewPayrollPolicy({actorId:user.id,policyId:body.policyId,
     approved:body.approved});
    return json(200,{policy,payable:false,payrollAutoApproved:false});
   }
  }catch(e){
   if(['FORBIDDEN','SELF_APPROVAL_FORBIDDEN'].includes(e?.code))
    return json(403,{error:'permission_denied'});
   if(['PENDING_PAYROLL_POLICY','POLICY_DATE_IN_USE'].includes(e?.code))
    return json(409,{error:'payroll_policy_conflict'});
   if(e?.code==='INVALID_PAYROLL_POLICY'||e?.code==='INVALID_REVIEW')
    return json(400,{error:'invalid_payroll_policy'});
   if(e?.code==='NOT_FOUND')return json(404,{error:'not_found'});
   return json(503,{error:'payroll_policy_unavailable'});
  }
  return json(404,{error:'not_found'});
 };
}
export const PAYROLL_POLICY_ROUTES=Object.freeze(Object.keys(routes));