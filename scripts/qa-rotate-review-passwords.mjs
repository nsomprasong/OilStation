#!/usr/bin/env node
// One-time, manually approved QA review credential rotation.
// DO NOT run on normal CI/deploy. Credentials come only from GitHub Secrets.
import {createClient} from '@supabase/supabase-js';
import {normalizeQaReviewPassword} from '../src/domain/qa-review-password.mjs';
import {QA_REVIEW_IDENTITIES} from '../src/domain/qa-review-identities.mjs';

const PROJECT='cxihsotcpdnalswfoysx';
const URL='https://'+PROJECT+'.supabase.co';
const QA_RUN='QA-20261031-PLATFORM-001';
const CONFIRM='QA-20261104-REVIEW-98';
const selected=Object.freeze(QA_REVIEW_IDENTITIES.map(x=>x.alias));
const roleByAlias=new Map(QA_REVIEW_IDENTITIES.map(x=>[x.alias,x]));
const email=alias=>'qa-'+alias+'@qa.oilstation.invalid';
const fail=reason=>{throw Error(reason);};
const mode=process.argv[2];
if(!['--dry-run','--apply'].includes(mode))fail('Use --dry-run or --apply');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.GITHUB_REPOSITORY!=='nsomprasong/OilStation'||
   process.env.GITHUB_REF!=='refs/heads/main'||
   process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')
 fail('This operation is reserved for an explicit, main-branch manual GitHub Actions run');
const key=process.env.OILSTATION_QA_DB_KEY;
const password=normalizeQaReviewPassword(process.env.OILSTATION_QA_REVIEW_PASSWORD);
if(!key||!(key.startsWith('sb_secret_')||key.split('.').length===3))
 fail('Existing protected QA DB service credential is unavailable');
// The owner requested an easy eight-character QA-only password. Accept any
// eight ASCII letters/digits, without forcing upper/lower/number categories.
// Trimming only accidental outer whitespace avoids hidden copy/paste errors.
// NEVER relax requirements for real users or new QA account registration.
if(!password)
 fail('QA review password must contain exactly eight English letters or digits');
if(mode==='--apply'&&process.env.OILSTATION_QA_ROTATE_CONFIRM!==CONFIRM)
 fail('Missing explicit one-time QA review password rotation confirmation');
const client=createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const expected=new Map(selected.map(alias=>[email(alias),alias]));
const accounts=new Map();
for(let page=1;page<=25&&accounts.size<expected.size;page++){
 const {data,error}=await client.auth.admin.listUsers({page,perPage:200});
 if(error||!Array.isArray(data?.users))fail('Supabase Admin API user inventory failed');
 for(const u of data.users){
  const alias=expected.get(u.email);
  if(!alias)continue;
  if(accounts.has(alias))fail('Duplicate QA account alias: '+alias);
  if(u.app_metadata?.oilstation_qa!==true||
     u.app_metadata?.oilstation_qa_run_id!==QA_RUN||
     !u.email_confirmed_at||u.is_sso_user===true||
     (u.banned_until&&Date.parse(u.banned_until)>Date.now()))
    fail('QA account identity attestation failed: '+alias);
  accounts.set(alias,{id:u.id,email:u.email});
 }
 if(data.users.length<200)break;
}
if(accounts.size!==selected.length)
 fail('Required QA sample accounts missing; found '+accounts.size+' of '+selected.length);
console.log('QA accounts verified: '+accounts.size+
 '; scope groups: 2 Sales / 8 organization / 28 station / 60 corporate');
if(mode==='--dry-run'){
 console.log('PRECHECK PASS: all selected accounts are confirmed QA identities; no credentials changed');
 process.exit(0);
}
let rotated=0,verified=0,appRolesVerified=0;
for(const alias of selected){
 const u=accounts.get(alias);
 const {data,error}=await client.auth.admin.updateUserById(u.id,{password});
 if(error||data?.user?.id!==u.id)
  fail('QA rotation stopped after '+rotated+' accounts, during '+alias+
       '; inspect and repeat only after resolving the Admin API problem');
 rotated++;
 // Prove Supabase Auth really accepts the new password, not only that a
 // hash/update was acknowledged. Never log or store tokens.
 const login=createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await login.auth.signInWithPassword({email:u.email,password});
 if(result.error||result.data?.user?.id!==u.id||!result.data.session?.access_token)
  fail('QA rotation login verification failed at '+alias+' (rotated '+rotated+')');
 verified++;
 // Validate the actual deployed OilStation /api/me authorization route using
 // the just-issued short-lived user JWT. The QA account must have its correct
 // scope and role. This is a read-only check; no finance operation is invoked.
 let memberResponse;
 try{
   memberResponse=await fetch('https://oilstation.goldensoft.cloud/api/me',{
     method:'GET',
     headers:{authorization:'Bearer '+result.data.session.access_token},
     cache:'no-store',
     signal:AbortSignal.timeout(15000),
   });
 }catch{
   fail('QA app role verification transport failed at '+alias+' (rotated '+rotated+')');
 }
 if(memberResponse.status!==200)
   fail('QA app membership rejected at '+alias+
    ': HTTP '+memberResponse.status+' (rotated '+rotated+')');
 const actorView=await memberResponse.json().catch(()=>null);
 const expectedRole=roleByAlias.get(alias);
 if(actorView?.userId!==u.id||
    !Array.isArray(actorView.memberships)||
    !actorView.memberships.some(m=>
     m.scopeType===expectedRole.scopeType&&m.role===expectedRole.role))
   fail('QA app role mismatch at '+alias+' (rotated '+rotated+')');
 appRolesVerified++;
 await login.auth.signOut().catch(()=>{});
 console.log('PASS '+alias+' (password and token redacted; actor role verified)');
}
console.log('QA_REVIEW_PASSWORD_ROTATION_PASS='+rotated+
 '; AUTH_SIGNIN_PASS='+verified+'; APP_ROLE_CHECK_PASS='+appRolesVerified);
