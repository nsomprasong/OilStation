// Authenticated, server-side-only fixture account provisioner.
// It is not public registration and never bypasses Supabase Auth or memberships.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN=/^QA-[0-9]{8}-[A-Z0-9-]{3,40}$/;
const ALIAS=/^[a-z][a-z0-9-]{2,30}$/;
const ROLES={
 platform:new Set(['platform_sales','platform_support']),
 organization:new Set(['organization_owner','billing_manager']),
 station:new Set(['station_owner','manager','cashier','attendant','pump_staff','hr_manager','finance_manager']),
 corporate_company:new Set(['corporate_admin','coupon_issuer','accountant','finance_manager','driver']),
};
// A frozen alias catalog prevents unbounded test accounts from being created.
const STATION_CODES=['s01a','s01b','s02a','s02b'];
const ROLE_SUFFIX={
 organization:{organization_owner:'owner',billing_manager:'billing'},
 station:{station_owner:'owner',manager:'manager',cashier:'cashier',
  attendant:'attendant',pump_staff:'pump',hr_manager:'hr',
  finance_manager:'finance'},
 corporate_company:{corporate_admin:'admin',coupon_issuer:'issuer',
  accountant:'accountant',finance_manager:'finance',driver:'driver'},
};
export function qaApprovedAlias({alias,scopeType,roleCode,scopeId},allowed){
 if(scopeType==='platform'){
  if(roleCode==='platform_sales')return alias==='sales01'||alias==='sales02';
  if(roleCode==='platform_support')return alias==='support01';
  return false;
 }
 const i=(allowed[scopeType]||[]).indexOf(scopeId);
 const suffix=ROLE_SUFFIX[scopeType]?.[roleCode];
 if(i<0||!suffix)return false;
 const prefix=scopeType==='organization'?'o'+String(i+1).padStart(2,'0'):
  scopeType==='station'?STATION_CODES[i]:'c'+String(i+1).padStart(2,'0');
 return Boolean(prefix)&&alias===prefix+'-'+suffix;
}
const json=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
}});
const parseIds=s=>typeof s==='string'&&s.trim()?s.split(',').map(x=>x.trim()).filter(x=>UUID.test(x)):[];
export function qaIsEnabled(env){
 return env?.OILSTATION_DEPLOY_TARGET==='production' &&
   env?.OILSTATION_PREVIEW_LOGIN_ENABLED==='true' &&
   env?.OILSTATION_API_ENABLED!=='true' &&
   env?.OILSTATION_QA_MODE_ENABLED==='true' &&
   RUN.test(env?.OILSTATION_QA_RUN_ID||'');
}
export function qaScopeAllowlist(env){
 return {
  platform:[],
  organization:parseIds(env.OILSTATION_QA_ORGANIZATION_IDS),
  station:parseIds(env.OILSTATION_QA_STATION_IDS),
  corporate_company:parseIds(env.OILSTATION_QA_COMPANY_IDS),
 };
}
export function createQaAccountsApi({env,authenticate,db,provisionAccount,resetQaPassword}){
 return async function handle(request){
  if(!qaIsEnabled(env))return json(404,{error:'not_found'});
  const url=new URL(request.url);
  if(!['GET','POST'].includes(request.method))return json(405,{error:'method_not_allowed'});
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return json(401,{error:'unauthenticated'});
  try{
   const user=await authenticate(token);
   if(!UUID.test(user?.id||''))return json(401,{error:'unauthenticated'});
   const memberships=await db.memberships(user.id);
   if(!memberships?.some(m=>m.active===true&&m.scope_type==='platform'&&
     m.role_code==='platform_superadmin'))
    return json(403,{error:'permission_denied'});
   const permitted=qaScopeAllowlist(env);
   // No scope IDs are accepted outside a pre-approved server allowlist.
   if(permitted.organization.length>4||permitted.station.length>4||permitted.corporate_company.length>12)
    return json(503,{error:'qa_scope_misconfigured'});
   if(request.method==='GET'){
    if(url.pathname!=='/api/qa/scopes')return json(404,{error:'not_found'});
    const available=await db.qaScopedOptions(permitted);
    return json(200,{runId:env.OILSTATION_QA_RUN_ID,scopes:available});
   }
   if(url.pathname!=='/api/qa/accounts'&&url.pathname!=='/api/qa/reset-password')
    return json(404,{error:'not_found'});
   if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
    return json(415,{error:'unsupported_media_type'});
   const input=await request.text();
   if(input.length>2048)return json(413,{error:'invalid_input'});
   let body;try{body=JSON.parse(input)}catch{return json(400,{error:'invalid_input'})}
   const {alias,password,scopeType,scopeId,roleCode}=body||{};
   if(url.pathname==='/api/qa/reset-password'){
    // Existing synthetic account only; never allow a password reset for a
    // real user, or for a QA user belonging to another run.
    if(!ALIAS.test(alias||'')||typeof password!=='string'||
      password.length<16||password.length>128||!/[a-z]/i.test(password)||
      !/[0-9]/.test(password)||!/[!@#$%^&*()_+\\-=]/.test(password))
     return json(400,{error:'invalid_input'});
    if(typeof resetQaPassword!=='function')return json(503,{error:'qa_reset_unavailable'});
    const changed=await resetQaPassword({
      actorId:user.id,qaRunId:env.OILSTATION_QA_RUN_ID,alias,password,
    });
    if(!changed)return json(404,{error:'qa_account_not_found'});
    return json(200,{alias,reset:true});
   }
   if(!ALIAS.test(alias||'')||typeof password!=='string'||
     password.length<16||password.length>128||!/[a-z]/i.test(password)||
     !/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=]/.test(password)||
     !ROLES[scopeType]?.has(roleCode))
    return json(400,{error:'invalid_input'});
   if(scopeType==='platform'){
    if(scopeId!==null && scopeId!==undefined && scopeId!=='')
     return json(400,{error:'invalid_scope'});
    // Exactly two Sales account aliases, two distinct creator-owned stations per Sales.
    if(roleCode==='platform_sales'&&!['sales01','sales02'].includes(alias))
     return json(400,{error:'sales_limit_two'});
   }else if(!UUID.test(scopeId||'')||!permitted[scopeType].includes(scopeId)){
    return json(403,{error:'scope_not_approved'});
   }
   if(!qaApprovedAlias({alias,scopeType,roleCode,scopeId},permitted))
    return json(400,{error:'qa_alias_not_in_approved_role_matrix'});
   const result=await provisionAccount({
    actorId:user.id,qaRunId:env.OILSTATION_QA_RUN_ID,
    alias,password,scopeType,scopeId:scopeType==='platform'?null:scopeId,roleCode,
   });
   return json(201,{account:result});
  }catch{return json(503,{error:'qa_account_operation_failed'})}
 };
}
