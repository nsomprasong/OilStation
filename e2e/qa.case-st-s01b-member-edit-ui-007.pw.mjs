import {test,expect} from '@playwright/test';

// OS-QA-ST-MEMBER-EDIT-UI-007: only review/cancel an authorized member role editor.
// One existing station owner; no write to any production membership or API.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-EDIT-UI-007';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
const EDITABLE=['manager','cashier','attendant','pump_staff','hr_manager','finance_manager'];
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected sequential one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA review Secret unavailable');
});
test(CASE+': scoped editor review, role options, cancel and no persistence @qa-one-case',async({page})=>{
 test.setTimeout(105_000);
 const writes=[],jsErrors=[];
 page.on('pageerror',()=>jsErrors.push('javascript_exception'));
 page.on('request',req=>{
  try{const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
      !['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(url.pathname);
  }catch{}
 });
 const start=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(start?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const s=JSON.parse(localStorage.getItem(key));if(s?.access_token)return s.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const who=await page.request.get(BASE+'/api/me',{headers});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('station_owner');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: owner scope verified');

 const path=BASE+'/api/members/directory?'+new URLSearchParams({scopeType:'station',scopeId:STATION});
 const scoped=await page.request.get(path,{headers});
 expect(scoped.status()).toBe(200);
 const members=(await scoped.json()).members;
 expect(Array.isArray(members)).toBe(true);
 const member=members.find(m=>m.active&&EDITABLE.includes(m.role)&&m.role==='manager'&&m.email);
 expect(member,'known QA station must have an active manager with email').toBeTruthy();
 const owner=members.find(m=>m.active&&m.role==='station_owner');
 expect(owner,'protected owner must exist').toBeTruthy();

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first();
 await expect(tile).toBeVisible({timeout:14_000});
 await tile.click();
 const screen=page.locator('[data-ws-screen="invitations"]:visible');
 await expect(screen).toBeVisible({timeout:12_000});
 const dir=screen.locator('.os-member-directory-host');
 await expect(dir.locator('table.os-directory-table')).toBeVisible({timeout:14_000});
 const search=dir.locator('input.os-directory-search');
 await search.fill(member.email);
 const rows=dir.locator('table.os-directory-table tbody tr');
 const selected=rows.filter({hasText:member.email});
 await expect(selected).toHaveCount(1);
 const edit=selected.getByRole('button',{name:'แก้ไขบทบาท '+member.displayName});
 await expect(edit).toBeVisible();
 await edit.click();
 const dialog=dir.locator('dialog.os-directory-dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('#os-directory-dialog-title')).toHaveText('แก้ไขบทบาทสมาชิก');
 await expect(dialog.locator('.os-directory-dialog-info')).toContainText(member.displayName);
 const role=dialog.locator('select.os-directory-role');
 await expect(role).toBeVisible();
 await expect(role).toHaveValue(member.role);
 const options=await role.locator('option').evaluateAll(xs=>xs.map(x=>x.value));
 expect(options).toEqual(EDITABLE);
 expect(options).not.toContain('station_owner');
 await expect(dialog.getByRole('button',{name:'บันทึกบทบาท'})).toBeVisible();
 console.log('QA_CASE '+CASE+' EDIT_DIALOG_PASS: existing role and exact six staff choices');

 await role.selectOption('cashier');
 await expect(role).toHaveValue('cashier');
 await dialog.getByRole('button',{name:'ยกเลิก'}).click();
 await expect(dialog).not.toBeVisible();
 expect(writes,'cancel must not call member change API').toEqual([]);
 console.log('QA_CASE '+CASE+' CANCEL_PASS: changed draft role not sent');

 const afterCancel=await page.request.get(path,{headers});
 expect(afterCancel.status()).toBe(200);
 const updated=(await afterCancel.json()).members.find(m=>m.membershipId===member.membershipId);
 expect(updated).toBeTruthy();
 expect(updated.role,'server-stored member role must be unchanged').toBe(member.role);
 await edit.click();
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('select.os-directory-role')).toHaveValue(member.role);
 await dialog.getByRole('button',{name:'ยกเลิก'}).click();
 await expect(dialog).not.toBeVisible();
 console.log('QA_CASE '+CASE+' NOT_PERSISTED_PASS: reopened dialog and API retain initial role');

 await search.fill(owner.email);
 const ownerRow=rows.filter({hasText:owner.email});
 await expect(ownerRow).toHaveCount(1);
 await expect(ownerRow.locator('.os-directory-protected')).toContainText('บัญชีที่ได้รับการป้องกัน');
 await expect(ownerRow.locator('button[aria-label^="แก้ไขบทบาท"]')).toHaveCount(0);
 console.log('QA_CASE '+CASE+' OWNER_PROTECTED_PASS: no owner edit action exposed');
 expect(writes,'no POST/PUT/PATCH/DELETE to OilStation API').toEqual([]);
 expect(jsErrors,'no unhandled JS errors').toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + EDIT_DIALOG_PASS + CANCEL_PASS + NOT_PERSISTED_PASS + OWNER_PROTECTED_PASS + NO_WRITES');
});
