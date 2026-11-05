import {test,expect} from '@playwright/test';

// QA-20261105-THREE-GROUP-READONLY-001
// Real protected browser → actual live guarded preview → EXISTING QA actors only.
// NO POST/PUT/PATCH/DELETE to OilStation API, coupon issuance, bank/Stripe,
// record mutation, live payroll, user creation, or unencrypted evidence.
const BASE='https://oilstation.goldensoft.cloud';
const stations=[
 {code:'s01a',sales:'sales01',org:'o01',id:'e22fb5ff-1878-446f-ab8d-585115e8a1a9',orgId:'d6f31134-2c74-41d8-8bc3-6d83bb41840b',
  companies:['4e6a3fc9-217d-4543-885b-113f1f3ba4c3','7f3dae09-5ff4-409c-bdf8-049086f99b7a','ff5796e7-e567-4790-aec6-0d5101fcd884']},
 {code:'s01b',sales:'sales01',org:'o02',id:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',orgId:'948d946d-aa98-4718-b246-991313371ddb',
  companies:['ab0a1f24-9a15-4a00-9da8-0a09397e4b24','4b19a8db-6b66-4707-8c5e-46648adbbe31','86bec094-71b8-4d9c-bea8-fdeed7c2ca66']},
 {code:'s02a',sales:'sales02',org:'o03',id:'24dc4981-0e6f-4b86-bfd7-03717002d0be',orgId:'db30c758-533c-463c-a226-d49f032e960a',
  companies:['9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6','963161ff-078a-4176-8762-47daf1075d20','c55f48a5-76b2-478f-97ea-727f03ed2a9d']},
 {code:'s02b',sales:'sales02',org:'o04',id:'02183a4e-47b0-4575-9f4f-74cec6553205',orgId:'e5cb8456-5611-421b-8265-229f6b1daa65',
  companies:['9da2618b-151c-45df-aad6-16519ec76535','9b6da1cc-946f-4756-8e0e-8ce020ca6209','88a9d686-e2c3-4cef-8a2a-1a888354a4c7']}
];
const companies=stations.flatMap((station,i)=>station.companies.map((id,j)=>({
 station,id,alias:'c'+String(1+i*3+j).padStart(2,'0')
})));
const expected={
 sales:['sales','activity','stations','invitations'],
 stationOwner:['plan','fuel','pump','customers','finance','hr','attendance','reviews','payroll','invitations'],
 cashier:['pump','attendance'],
 hr:['hr','attendance','reviews','payroll'],
 corporateAdmin:['corporate','invitations'],
 issuer:['corporate'],
 driver:['driver'],
 organizationOwner:['billing']
};
const need=name=>{
 const v=process.env[name];
 if(!v)throw Error('Missing secret NAME '+name);
 return v;
};
// Owner-approved 98-account QA review credential. Never log its value.
const reviewPassword=()=>need('OILSTATION_QA_REVIEW_PASSWORD');
const actorSales=alias=>({
 alias,station:stations.find(s=>s.sales===alias),
 role:'platform_sales',scopeType:'platform',scopeId:null,field:null,
 password:reviewPassword,
 pages:expected.sales
});
const actorStation=(s,suffix='owner')=>{
 const role=suffix==='owner'?'station_owner':suffix==='hr'?'hr_manager':suffix;
 return {alias:s.code+'-'+suffix,station:s,role,scopeType:'station',
  scopeId:s.id,field:'stationId',password:reviewPassword,
  pages:expected[suffix==='owner'?'stationOwner':suffix]};
};
const actorOrg=(s)=>({
 alias:s.org+'-owner',station:s,role:'organization_owner',scopeType:'organization',
 scopeId:s.orgId,field:'organizationId',
 password:reviewPassword,pages:expected.organizationOwner
});
const actorCompany=(c,suffix='admin')=>({
 alias:c.alias+'-'+suffix,station:c.station,
 role:({admin:'corporate_admin',issuer:'coupon_issuer',driver:'driver'})[suffix],
 scopeType:'corporate_company',scopeId:c.id,field:'corporateCompanyId',
 password:reviewPassword,
 pages:expected[suffix==='admin'?'corporateAdmin':suffix]
});
test.use({headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_THREE_GROUP_SWEEP!=='true',
  'Live screen sweep is restricted to the GitHub protected main-branch QA environment');
 need('OILSTATION_QA_REVIEW_PASSWORD');
});

/** Detect the app's own QA auth message instead of waiting 45s for Home. */
async function waitForQaWorkspace(page){
 const status=async()=>{
  if(await page.locator('[data-ws-screen="overview"]:visible').count())return 'ready';
  const notice=page.locator('#notice[data-tone="error"]:visible');
  if(await notice.count()){
   const message=(await notice.textContent())||'';
   return message.includes('ชื่อผู้ใช้หรือรหัสผ่านทดสอบไม่ถูกต้อง')
    ?'auth-credentials-rejected':'auth-service-or-form-error';
  }
  if(await page.locator('#reason:visible').count())return 'workspace-startup-error';
  return 'pending';
 };
 await expect.poll(status,{timeout:38000,intervals:[150,350,600,1000],
  message:'QA login must reach Home or an explicit safe failure state'}).not.toBe('pending');
 const result=await status();
 if(result!=='ready')throw Error('QA_LOGIN_'+result);
}

async function authenticate(page,actor){
 const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(response?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:45_000});
 await page.locator('#qa-login-alias').fill(actor.alias);
 await page.locator('#qa-login-password').fill(actor.password());
 await page.locator('#qa-login-form button[type="submit"]').click();
 await waitForQaWorkspace(page);
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(key));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token,'QA identity login resulted in a real session').toBeTruthy();
 const me=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(me.status(),'backend authorization /api/me').toBe(200);
 const result=await me.json();
 expect(result.memberships,'single isolated QA scope').toHaveLength(1);
 const membership=result.memberships[0];
 expect(membership.role).toBe(actor.role);
 expect(membership.scopeType).toBe(actor.scopeType);
 if(actor.field)expect(membership[actor.field]).toBe(actor.scopeId);
}
const pathOnly=url=>{
 try{const u=new URL(url);return u.hostname==='oilstation.goldensoft.cloud'?u.pathname:'';}catch{return'';}
};
async function visitMain(page,key){
 if((await page.locator('[data-workspace-shell]').getAttribute('data-active-screen'))!=='overview'){
  await page.locator('[data-ws-go="overview"]:visible').first().click();
  await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
 }
 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="'+key+'"]:visible').first();
 await expect(tile,'Home must expose authorized '+key+' destination').toBeVisible({timeout:15_000});
 await tile.click();
 await expect(page.locator('[data-ws-screen="'+key+'"]:visible')).toBeVisible({timeout:15_000});
 await expect(page.locator('[data-context-for="'+key+'"]:visible')).toBeVisible({timeout:15_000});
 const count=await page.locator('.ws-screen:visible').count();
 expect(count,'only one primary screen visible').toBe(1);
 const screen=page.locator('[data-ws-screen="'+key+'"]');
 await expect(screen.locator('.ws-screen-head h2')).toBeVisible({timeout:10_000});
 await expect(screen.locator('.ws-widget').first()).not.toBeEmpty({timeout:15_000});
}
async function exercisePanes(page,key){
 const tabs=page.locator('[data-context-for="'+key+'"] button[data-os-pane-key]:visible');
 // Existing single-task screens may render a single contextual button.
 const waitUntil=Date.now()+7500;
 let num=await tabs.count();
 while(num===0&&Date.now()<waitUntil){
  await page.waitForTimeout(200);
  num=await tabs.count();
 }
 // "invitations" intentionally omits its redundant one-tab navigation.
 if(key==='invitations')return 'single workflow (context nav intentionally hidden)';
 if(num===0)throw Error('No functional submenu found for '+key);
 const exercised=[];
 for(let i=0;i<num;i++){
  const t=tabs.nth(i);
  const id=await t.getAttribute('data-os-pane-key');
  await t.click({timeout:12_000});
  await expect(t,'selected submenu '+key+'/'+id).toHaveAttribute('aria-pressed','true');
  // Multi-pane screens must have one and only one active *task wrapper*.
  const wrappers=page.locator('[data-ws-screen="'+key+'"] .os-functional-pane');
  const count=await wrappers.count();
  if(count){
   const visible=await wrappers.filter({visible:true}).count();
   expect(visible,'one visible task after '+key+'/'+id).toBe(1);
  }
  exercised.push(id);
  await page.waitForTimeout(90);
 }
 return exercised.join(',');
}
async function auditActor(browser,actor,width,phase,results){
 const context=await browser.newContext({viewport:{width,height:width<=850?844:900}});
 const page=await context.newPage();
 const errors=[],requests=[];
 page.on('pageerror',()=>{errors.push('page-exception');});
 page.on('response',response=>{
  const path=pathOnly(response.url());
  if(path.startsWith('/api/')&&response.status()>=400)
   requests.push({path,status:response.status()});
 });
 page.on('request',req=>{
  const path=pathOnly(req.url());
  if(path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
   errors.push('unexpected-app-write:'+path);
 });
 try{
  await authenticate(page,actor);
  for(const key of actor.pages){
   const at=requests.length,et=errors.length;
   let problem=null,visited='';
   try{
    await visitMain(page,key);
    visited=await exercisePanes(page,key);
   }catch(e){
    problem=String(e?.message||e).split('\n')[0].slice(0,185);
   }
   const failed=requests.slice(at).filter(x=>x.status!==503);
   const blocked=requests.slice(at).filter(x=>x.status===503);
   const browserErrors=errors.slice(et);
   const status=problem||failed.length||browserErrors.length?'FAIL':blocked.length?'BLOCKED':'PASS';
   const item={phase,actor:actor.alias,viewport:width,key,status,
    panes:visited,api:requests.slice(at).map(x=>x.status+':'+x.path),
    issue:problem||browserErrors.join(',')};
   results.push(item);
   // Print ONLY fixed aliases, menu keys and endpoint *paths*. Never JWT,
   // request body/response body, account identifiers, station names or values.
   console.log('QA3 '+JSON.stringify(item));
   // Home first on the next iteration, even if the current tab failed.
   if(problem){
    try{await page.locator('[data-ws-go="overview"]:visible').first().click({timeout:4000});}
    catch{}
   }
  }
 }catch(e){
  const item={phase,actor:actor.alias,viewport:width,key:'LOGIN',status:'FAIL',
   issue:String(e?.message||e).split('\n')[0].slice(0,185)};
  results.push(item);console.log('QA3 '+JSON.stringify(item));
 }finally{await context.close();}
}
function finishGroup(name,results){
 const counts=Object.fromEntries(['PASS','BLOCKED','FAIL'].map(k=>[k,results.filter(x=>x.status===k).length]));
 console.log('QA3-SUMMARY '+name+' '+JSON.stringify({counts,total:results.length}));
 expect(results.length,'group must visit each intended screen').toBeGreaterThan(0);
 const fails=results.filter(x=>x.status==='FAIL').map(x=>
  x.actor+'/'+x.key+': '+(x.issue||x.api?.join(',')));
 expect(fails,name+' UI errors by page (BLOCKED 503 does not count as PASS)').toEqual([]);
}
test('QA3-P1 Platform screens and functional submenus, Sales01/Sales02 @qa-fullscreen',async({browser})=>{
 test.setTimeout(13*60_000);
 const results=[];
 await auditActor(browser,actorSales('sales01'),1440,'PLATFORM',results);
 await auditActor(browser,actorSales('sales02'),390,'PLATFORM',results);
 finishGroup('PLATFORM',results);
});
test('QA3-P2 Station owner, cashier, HR and organization billing screens @qa-fullscreen',async({browser})=>{
 test.setTimeout(35*60_000);
 const results=[];
 for(const s of stations)await auditActor(browser,actorStation(s),s.code==='s01a'?1440:390,'STATION',results);
 for(const s of stations)await auditActor(browser,actorStation(s,'cashier'),390,'STATION',results);
 await auditActor(browser,actorStation(stations[0],'hr'),390,'STATION',results);
 await auditActor(browser,actorOrg(stations[0]),390,'STATION',results);
 finishGroup('STATION',results);
});
test('QA3-P3 Corporate all twelve admins and representative driver/issuer screens @qa-fullscreen',async({browser})=>{
 test.setTimeout(35*60_000);
 const results=[];
 for(const [i,c] of companies.entries())
  await auditActor(browser,actorCompany(c),i===0?1440:390,'CORPORATE',results);
 for(const i of [0,3,6,9]){
  await auditActor(browser,actorCompany(companies[i],'driver'),390,'CORPORATE',results);
  await auditActor(browser,actorCompany(companies[i],'issuer'),390,'CORPORATE',results);
 }
 finishGroup('CORPORATE',results);
});
