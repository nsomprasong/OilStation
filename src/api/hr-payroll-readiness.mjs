import {assessPayrollReadiness} from '../domain/hr-payroll-readiness.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const day=s=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const d=new Date(s+'T00:00:00.000Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===s?d:null;
};
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
export function createPayrollReadinessApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/hr/payroll/readiness')return json(404,{error:'not_found'});
  if(request.method!=='GET')return json(405,{error:'method_not_allowed'});
  const auth=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!auth)return json(401,{error:'unauthenticated'});
  const employeeId=url.searchParams.get('employeeId');
  const startDate=url.searchParams.get('startDate'),endDate=url.searchParams.get('endDate');
  const start=day(startDate),end=day(endDate);
  if(!UUID.test(employeeId||'')||!start||!end||end<=start||end-start>35*86400000)
   return json(400,{error:'invalid_payroll_period'});
  let actor;
  try{actor=await authenticate(auth);}catch{return json(401,{error:'unauthenticated'});}
  if(!UUID.test(actor?.id||''))return json(401,{error:'unauthenticated'});
  try{
   const evidence=await db.hrPayrollReadinessEvidence({actorId:actor.id,employeeId,startDate,endDate});
   if(evidence.employeeId!==employeeId||evidence.startDate!==startDate||
      evidence.endDate!==endDate||!UUID.test(evidence.stationId||''))
    throw new Error('invalid_evidence_scope');
   return json(200,assessPayrollReadiness(evidence));
  }catch(error){
   if(error?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(error?.code==='NOT_FOUND')return json(404,{error:'employee_not_found'});
   if(error?.code==='INVALID_PAYROLL_DATE')return json(400,{error:'invalid_payroll_period'});
   return json(503,{error:'payroll_readiness_unavailable'});
  }
 };
}