import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const BASE='https://oilstation.goldensoft.cloud';
const ADMIN='11111111-1111-4111-8111-111111111111';
const STATION='22222222-2222-4222-8222-222222222222';
const INVITE='33333333-3333-4333-8333-333333333333';
const email='owner-test@example.com';
function environment(enabled){
 return {
  ASSETS:{fetch:async()=>new Response('<html></html>')},
  OILSTATION_DEPLOY_TARGET:'production',
  OILSTATION_API_ENABLED:'false',
  OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
  OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',
  SUPABASE_URL:'https://fake-project.supabase.co',
  SUPABASE_ANON_KEY:'public_unit_key',
  SUPABASE_SERVICE_ROLE_KEY:'test_only_private_service_key',
  COUPON_SIGNING_KEY:'A'.repeat(48),
  RESEND_API_KEY:'re_'+'z'.repeat(32),
  INVITATION_FROM_EMAIL:'no-reply@oilstation.goldensoft.cloud',
  INVITATION_EMAIL_ENABLED:enabled?'true':'false',
 };
}
const issue=()=>new Request(BASE+'/api/invitations/create',{
 method:'POST',headers:{authorization:'Bearer verified',origin:BASE,'content-type':'application/json'},
 body:JSON.stringify({email,roleCode:'station_owner',scopeType:'station',scopeId:STATION}),
});

test('end-to-end Worker invitation: trusted DB invitation then Resend provider acceptance',async()=>{
 const old=globalThis.fetch,calls=[];
 const env=environment(true);
 globalThis.fetch=async (url,init)=>{
  const path=String(url);calls.push(path);
  if(path.endsWith('/auth/v1/user')){
   assert.equal(init.headers.apikey,env.SUPABASE_ANON_KEY);
   return new Response(JSON.stringify({id:ADMIN}),{status:200});
  }
  if(path.includes('/rest/v1/memberships?')){
   assert.equal(init.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
   return new Response(JSON.stringify([{active:true,scope_type:'platform',role_code:'platform_superadmin',
    user_id:ADMIN,station_id:null,organization_id:null,corporate_company_id:null,extra_permissions:{}}]),{status:200});
  }
  if(path.endsWith('/rpc/create_scoped_invitation')){
   const body=JSON.parse(init.body);
   assert.equal(body.p_actor_id,ADMIN);
   assert.equal(body.p_station_id,STATION);
   assert.equal(body.p_email,email);
   assert.match(body.p_token_hash,/^[a-f0-9]{64}$/);
   return new Response(JSON.stringify({id:INVITE,email}),{status:200});
  }
  if(path==='https://api.resend.com/emails'){
   assert.equal(init.headers.authorization,'Bearer '+env.RESEND_API_KEY);
   const payload=JSON.parse(init.body);
   assert.deepEqual(payload.to,[email]);
   assert.equal(payload.from,'OilStation <no-reply@oilstation.goldensoft.cloud>');
   assert.ok(payload.html.includes('คำเชิญ'));
   assert.match(payload.text,/oilstation\.goldensoft\.cloud\/invite\//);
   return new Response(JSON.stringify({id:'email_1234567890'}),{status:200});
  }
  throw Error('unexpected outbound URL: '+path);
 };
 try{
  const result=await worker.fetch(issue(),env);
  assert.equal(result.status,201);
  const {invitation}=await result.json();
  assert.equal(invitation.delivery,'email_accepted');
  assert.equal(invitation.deliveryStatus,'provider_accepted');
  assert.match(invitation.inviteUrl,/^https:\/\/oilstation\.goldensoft\.cloud\/invite\/[A-Za-z0-9_-]{43}$/);
  assert.equal(calls.filter(x=>x==='https://api.resend.com/emails').length,1);
  assert.ok(!JSON.stringify(invitation).includes(env.RESEND_API_KEY));
 }finally{globalThis.fetch=old;}
});

test('if provider is disabled, invitation remains manual without contacting Resend',async()=>{
 const old=globalThis.fetch,calls=[];
 const env=environment(false);
 globalThis.fetch=async(url,init)=>{
  const path=String(url);calls.push(path);
  if(path.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:ADMIN}),{status:200});
  if(path.includes('/rest/v1/memberships?'))return new Response(JSON.stringify([{active:true,scope_type:'platform',
   role_code:'platform_superadmin',user_id:ADMIN,extra_permissions:{}}]),{status:200});
  if(path.endsWith('/rpc/create_scoped_invitation')){
   assert.equal(JSON.parse(init.body).p_email,email);
   return new Response(JSON.stringify({id:INVITE,email}),{status:200});
  }
  throw Error('unexpected provider call');
 };
 try{
  const result=await worker.fetch(issue(),env);
  assert.equal(result.status,201);
  const {invitation}=await result.json();
  assert.equal(invitation.delivery,'manual');
  assert.equal(invitation.deliveryStatus,'not_enabled');
  assert.ok(!calls.includes('https://api.resend.com/emails'));
 }finally{globalThis.fetch=old;}
});
