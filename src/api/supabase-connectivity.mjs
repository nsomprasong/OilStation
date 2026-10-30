// Read-only, opt-in operator connectivity probe.
// This is NEVER a public health endpoint. No tenant rows are read or returned.
const response=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'}
});
const SUPABASE=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/;
async function sameToken(left,right){
 if(typeof left!=='string'||typeof right!=='string'||left.length>512||right.length>512)
  return false;
 // Hash first so even distinct token lengths take the same comparison loop.
 const data=new TextEncoder(),[a,b]=await Promise.all(
  [left,right].map(v=>crypto.subtle.digest('SHA-256',data.encode(v)).then(x=>new Uint8Array(x))));
 let mismatch=0;
 for(let i=0;i<32;i++) mismatch|=a[i]^b[i];
 return mismatch===0;
}
async function check(url,key,fetchImpl){
 try{
  const headers={apikey:key,accept:'application/json'};
  // Modern sb_secret keys are not JWTs, but legacy service_role JWTs need
  // Authorization for PostgREST. Never echo either header in a response.
  if(!key.startsWith('sb_')&&key.split('.').length===3)
   headers.authorization='Bearer '+key;
  const r=await fetchImpl(url,{method:'GET',headers,redirect:'error',
   signal:AbortSignal.timeout(6500)});
  return r.status===200;
 }catch{return false;}
}
export function createSupabaseConnectivityProbe(env,{fetchImpl=fetch}={}){
 return async request=>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/internal/supabase-connectivity')
   return response(404,{error:'not_found'});
  if(env?.OILSTATION_DIAGNOSTICS_ENABLED!=='true'||typeof env?.DIAGNOSTICS_BEARER_TOKEN!=='string'||
    env.DIAGNOSTICS_BEARER_TOKEN.length<32)
   return response(404,{error:'not_found'});
  if(request.method!=='GET')return response(405,{error:'method_not_allowed'});
  // No cross-site browser calls. The caller must supply a distinct diagnostic
  // token; ordinary OilStation login credentials do not grant this capability.
  if(request.headers.has('origin'))return response(403,{error:'forbidden'});
  const given=/^Bearer ([A-Za-z0-9_-]{32,512})$/.exec(request.headers.get('authorization')||'');
  if(!given||!(await sameToken(given[1],env.DIAGNOSTICS_BEARER_TOKEN)))
   return response(401,{error:'unauthorized'});
  if(typeof env.SUPABASE_URL!=='string'||!SUPABASE.test(env.SUPABASE_URL)||
   typeof env.SUPABASE_ANON_KEY!=='string'||!env.SUPABASE_ANON_KEY||
   typeof env.SUPABASE_SERVICE_ROLE_KEY!=='string'||!env.SUPABASE_SERVICE_ROLE_KEY)
   return response(503,{connected:false,publicKeyValid:false,serviceKeyValid:false});
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const [publicKeyValid,serviceKeyValid]=await Promise.all([
   // Auth settings are read-only and require a valid public API key.
   check(base+'/auth/v1/settings',env.SUPABASE_ANON_KEY,fetchImpl),
   // Limit zero returns no station or customer data, while requiring the
   // server's privileged PostgREST API key to read an existing catalog table.
   check(base+'/rest/v1/brand_fuel_products?select=id&limit=0',
    env.SUPABASE_SERVICE_ROLE_KEY,fetchImpl),
  ]);
  const connected=publicKeyValid&&serviceKeyValid;
  return response(connected?200:503,{connected,publicKeyValid,serviceKeyValid});
 };
}
