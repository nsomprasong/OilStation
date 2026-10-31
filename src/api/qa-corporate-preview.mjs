import {qaIsEnabled,qaScopeAllowlist} from './qa-accounts.mjs';
const NAMES=['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
function json(status,body){return new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff',
}});}
export function createQaCorporatePreviewApi({env,authenticate,db}){
 return async request=>{
  if(!qaIsEnabled(env)||env.OILSTATION_PREVIEW_OPERATIONS_ENABLED!=='true')
    return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return json(403,{error:'invalid_origin'});
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
  const header=request.headers.get('authorization')||'';
  if(!/^Bearer [^\\s]{10,}$/.test(header))return json(401,{error:'authentication_required'});
  const actor=await authenticate(header.slice(7)).catch(()=>null);
  if(!actor?.id||actor.isQa!==true)return json(403,{error:'qa_role_required'});
  let body;
  try{const raw=await request.text();
   if(raw.length>8192)return json(413,{error:'payload_too_large'});
   body=JSON.parse(raw);
  }catch{return json(400,{error:'invalid_request'});}
  if(!body||typeof body!=='object'||Array.isArray(body))
   return json(400,{error:'invalid_request'});
  const ids=qaScopeAllowlist(env).station;
  if(ids.length!==4||new Set(ids).size!==4)return json(503,{error:'qa_scope_unavailable'});
  const i=ids.indexOf(body.stationId);
  if(i<0)return json(403,{error:'qa_station_only'});
  const name=String(body.name||'').trim();
  const m=new RegExp('^'+NAMES[i]+'-C0([1-3])$').exec(name);
  const slot=m?Number(m[1]):0;
  const email='qa-c'+String(i*3+slot).padStart(2,'0')+'-admin@qa.oilstation.invalid';
  if(!slot||body.contactEmail!==email||body.taxId!=null||
    body.paymentTermsDays!==0||body.dueMode!=='per_fill'||
    body.statementCloseDay!=null)return json(400,{error:'qa_fixture_only'});
  try{
   const memberships=await db.memberships(actor.id);
   if(!memberships?.some(m=>m.active===true&&m.scope_type==='station'&&
      m.station_id===body.stationId&&['station_owner','owner'].includes(m.role_code)))
    return json(403,{error:'scope_not_owned'});
   const result=await db.qaCreateCorporateCustomer({
    actorId:actor.id,qaRunId:env.OILSTATION_QA_RUN_ID,
    stationId:body.stationId,name,contactEmail:email,stationIds:ids,
   });
   return json(201,{customer:result});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST')return json(400,{error:'invalid_request'});
   return json(503,{error:'qa_company_unavailable'});
  }
 };
}
