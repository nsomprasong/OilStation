import {qaIsEnabled,qaScopeAllowlist} from './qa-accounts.mjs';
import {qaUatWindowOpen} from './qa-uat-window.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY=/^[1-9][0-9]{1,6}$/;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json; charset=utf-8',
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}});
const PREFIX='/api/qa/finance/topup/';
export function qaFinanceEnabled(env){
 return qaIsEnabled(env)&&qaUatWindowOpen(env)&&env.OILSTATION_PREVIEW_OPERATIONS_ENABLED==='true'&&
   env.OILSTATION_QA_FINANCE_SIM_ENABLED==='true';
}
export function createQaTopupSimulationApi({env,authenticate,db}){
 return async function handle(request){
  if(!qaFinanceEnabled(env))return json(404,{error:'not_found'});
  const url=new URL(request.url),operation=url.pathname.slice(PREFIX.length);
  if(!url.pathname.startsWith(PREFIX)||!['request','pending','review'].includes(operation))
   return json(404,{error:'not_found'});
  if(request.method!==(operation==='pending'?'GET':'POST'))
   return json(405,{error:'method_not_allowed'});
  if(operation!=='pending'&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  const allow=qaScopeAllowlist(env);
  if(allow.station.length!==4||allow.corporate_company.length!==12||
     new Set(allow.station).size!==4||new Set(allow.corporate_company).size!==12)
   return json(503,{error:'qa_scope_unavailable'});
  try{
   const actor=await authenticate(token[1]);
   if(!UUID.test(actor?.id??'')||actor?.isQa!==true)
    return json(403,{error:'qa_actor_only'});
   const memberships=(await db.memberships(actor.id)||[]).filter(x=>x.active===true);
   const stationApprove=stationId=>memberships.some(m=>
     m.scope_type==='station'&&m.station_id===stationId&&
     ['station_owner','owner','manager','cashier','finance_manager'].includes(m.role_code));
   if(operation==='pending'){
    const stationId=url.searchParams.get('stationId');
    if(!UUID.test(stationId??'')||!allow.station.includes(stationId))
     return json(403,{error:'qa_station_only'});
    if(!stationApprove(stationId))return json(403,{error:'permission_denied'});
    return json(200,{requests:await db.qaPendingTopups({
      actorId:actor.id,qaRunId:env.OILSTATION_QA_RUN_ID,stationId,allowed:allow})});
   }
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   if(Number(request.headers.get('content-length'))>2048)
    return json(413,{error:'payload_too_large'});
   const raw=await request.text();
   if(raw.length>2048)return json(413,{error:'payload_too_large'});
   let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'invalid_json'});}
   if(!body||typeof body!=='object'||Array.isArray(body))
    return json(400,{error:'invalid_request'});
   if(operation==='request'){
    if(Object.keys(body).sort().join(',')!=='accountId,amountSatang,requestKey'||
       !UUID.test(body.accountId??'')||!UUID.test(body.requestKey??'')||
       typeof body.amountSatang!=='string'||!MONEY.test(body.amountSatang)||
       BigInt(body.amountSatang)<100n||BigInt(body.amountSatang)>5000000n)
     return json(400,{error:'invalid_simulated_amount'});
    if(!memberships.some(m=>m.scope_type==='corporate_company'&&
      allow.corporate_company.includes(m.corporate_company_id)&&
      ['corporate_admin','accountant','finance_manager'].includes(m.role_code)))
     return json(403,{error:'permission_denied'});
    return json(201,{request:await db.qaRequestTopup({
      actorId:actor.id,qaRunId:env.OILSTATION_QA_RUN_ID,
      accountId:body.accountId,amountSatang:body.amountSatang,
      requestKey:body.requestKey,allowed:allow})});
   }
   if(Object.keys(body).sort().join(',')!=='approved,requestId'||
      !UUID.test(body.requestId??'')||typeof body.approved!=='boolean')
    return json(400,{error:'invalid_review'});
   if(!memberships.some(m=>m.scope_type==='station'&&
      allow.station.includes(m.station_id)&&stationApprove(m.station_id)))
    return json(403,{error:'permission_denied'});
   return json(200,{result:await db.qaReviewTopup({
     actorId:actor.id,qaRunId:env.OILSTATION_QA_RUN_ID,
     requestId:body.requestId,approved:body.approved,allowed:allow})});
  }catch(e){
   if(e?.code==='FORBIDDEN'||e?.code==='SELF_APPROVAL_FORBIDDEN')
    return json(403,{error:'permission_denied'});
   if(e?.code==='PENDING_EXISTS'||e?.code==='QA_TOPUP_LIMIT_REACHED')
    return json(409,{error:'qa_topup_limit_or_pending'});
   if(e?.code==='INVALID_REQUEST')return json(400,{error:'invalid_request'});
   return json(503,{error:'qa_finance_unavailable'});
  }
 };
}
