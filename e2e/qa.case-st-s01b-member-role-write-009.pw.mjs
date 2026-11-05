import {test,expect} from '@playwright/test';
// OS-QA-ST-MEMBER-ROLE-WRITE-009: bounded QA-only role write then mandatory restore.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-ROLE-WRITE-009';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const TARGET_ID='65d3c545-59b3-4704-9f52-2133ec741e36';
const TARGET_EMAIL='qa-s01b-attendant@qa.oilstation.invalid';
const ORIGINAL='attendant',TEMP='pump_staff';
const PATH='/api/members/change';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA protected Secret unavailable');
});
test(CASE+': synthetic staff edit, persistence, restore @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const pageWrites=[],jsErrors=[];
 page.on('pageerror',()=>jsErrors.push('javascript_exception'));
 page.on('request',req=>{
  try{const u=new URL(req.url());if(u.origin===BASE&&u.pathname.startsWith('/api/')
    &&!['GET','HEAD','OPTIONS'].includes(req.method()))
      pageWrites.push([u.pathname,req.method()]);}catch{}
 });
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(k));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status()).toBe(200);
 const scopes=(await me.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS');
 const dirUrl=BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION});
 const read=async()=>{
  const r=await page.request.get(dirUrl,{headers});
  expect(r.status()).toBe(200);
  return (await r.json()).members;
 };
 const find=async()=>(await read()).find(m=>m.membershipId===TARGET_ID);
 const target=await find();
 expect(target?.email,'exact fake identity only').toBe(TARGET_EMAIL);
 expect(target.role,'must start from known baseline').toBe(ORIGINAL);
 expect(target.active).toBe(true);
 expect((await read()).filter(m=>m.email===TARGET_EMAIL)).toHaveLength(1);
 console.log('QA_CASE '+CASE+' FIXTURE_PASS');
 let browserSaveAttempted=false,restores=0;
 try{
  await page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first().click();
  const dir=page.locator('[data-ws-screen="invitations"]:visible .os-member-directory-host');
  await expect(dir.locator('table.os-directory-table')).toBeVisible({timeout:14000});
  await dir.locator('input.os-directory-search').fill(TARGET_EMAIL);
  const row=dir.locator('tbody tr').filter({hasText:TARGET_EMAIL});
  await expect(row).toHaveCount(1);
  await row.getByRole('button',{name:'แก้ไขบทบาท '+target.displayName}).click();
  const dialog=dir.locator('dialog.os-directory-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select.os-directory-role')).toHaveValue(ORIGINAL);
  await dialog.locator('select.os-directory-role').selectOption(TEMP);
  const responsePromise=page.waitForResponse(r=>r.url().endsWith(PATH)
    &&r.request().method()==='POST',{timeout:20000});
  browserSaveAttempted=true;
  await dialog.getByRole('button',{name:'บันทึกบทบาท'}).click();
  const result=await responsePromise;
  expect(result.status(),'scoped member write must succeed').toBe(200);
  expect((await result.json()).result?.success).toBe(true);
  await expect(dialog).not.toBeVisible();
  await expect(row.locator('.os-directory-role-label')).toHaveText('พนักงานหน้าลาน',{timeout:14000});
  expect((await find())?.role,'role persisted at backend').toBe(TEMP);
  console.log('QA_CASE '+CASE+' REAL_WRITE_PASS: UI + API persisted temporary role');
 }finally{
  // Always attempt API recovery, even when assertions failed after a successful save.
  const current=await find();
  if(!current||current.email!==TARGET_EMAIL)
   throw Error('RESTORE_GUARD_FAILED: target changed');
  if(current.role!==ORIGINAL){
   if(current.role!==TEMP)throw Error('RESTORE_GUARD_FAILED: unexpected role');
   const restore=await page.request.post(BASE+PATH,{
    headers:{...headers,'content-type':'application/json'},
    data:{membershipId:TARGET_ID,action:'edit',roleCode:ORIGINAL}
   });
   expect(restore.status(),'RESTORE_MANDATORY').toBe(200);
   expect((await restore.json()).result?.success).toBe(true);
   restores++;
  }
  const after=await find();
  expect(after?.role,'role must be restored after the test').toBe(ORIGINAL);
  expect(after?.active).toBe(true);
  console.log('QA_CASE '+CASE+' RECOVERY_PASS: original role active, restore requests='+restores);
 }
 expect(browserSaveAttempted).toBe(true);
 expect(restores,'one restoration required').toBe(1);
 expect(pageWrites,'only one browser write to member-change').toEqual([[PATH,'POST']]);
 expect(jsErrors).toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + FIXTURE_PASS + REAL_WRITE_PASS + RECOVERY_PASS + TWO_BOUNDED_MUTATIONS');
});
