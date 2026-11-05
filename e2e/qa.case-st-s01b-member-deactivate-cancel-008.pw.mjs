import {test,expect} from '@playwright/test';

// Case 008: one QA station owner, one member deactivation confirmation drawer.
// Only inspect/cancel. Never submit the deactivation or issue a business write.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-DEACTIVATE-CANCEL-008';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected sequential one-case runner only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA review Secret unavailable');
});
test(CASE+': confirm dialog, cancel, unchanged member and protected owner @qa-one-case',async({page})=>{
 test.setTimeout(105_000);
 const writes=[],jsErrors=[];
 page.on('pageerror',()=>jsErrors.push('javascript_exception'));
 page.on('request',req=>{
  try{const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&
     !['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(url.pathname);
  }catch{}
 });
 const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
 expect(response?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25_000});
 await page.locator('#qa-login-alias').fill('s01b-owner');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30_000});
 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try{const item=JSON.parse(localStorage.getItem(key));if(item?.access_token)return item.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const auth=await page.request.get(BASE+'/api/me',{headers});
 expect(auth.status()).toBe(200);
 const scopes=(await auth.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].stationId).toBe(STATION);
 expect(scopes[0].role).toBe('station_owner');
 console.log('QA_CASE '+CASE+' AUTH_PASS: owner confined to s01b');
 const membersUrl=BASE+'/api/members/directory?'+
   new URLSearchParams({scopeType:'station',scopeId:STATION});
 const before=await page.request.get(membersUrl,{headers});
 expect(before.status()).toBe(200);
 const members=(await before.json()).members;
 expect(Array.isArray(members)).toBe(true);
 const manager=members.find(x=>x.role==='manager'&&x.active&&x.email&&x.displayName);
 expect(manager,'known station manager is active and identifiable').toBeTruthy();
 const owner=members.find(x=>x.role==='station_owner'&&x.active);
 expect(owner).toBeTruthy();

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first();
 await expect(tile).toBeVisible({timeout:14_000});
 await tile.click();
 const screen=page.locator('[data-ws-screen="invitations"]:visible');
 await expect(screen).toBeVisible({timeout:12_000});
 const directory=screen.locator('.os-member-directory-host');
 await expect(directory.locator('table.os-directory-table')).toBeVisible({timeout:14_000});
 const search=directory.locator('input.os-directory-search');
 await search.fill(manager.email);
 const row=directory.locator('tbody tr').filter({hasText:manager.email});
 await expect(row).toHaveCount(1);
 const deactivate=row.getByRole('button',{name:'ปิดสิทธิ์ '+manager.displayName});
 await expect(deactivate).toBeVisible();
 await deactivate.click();
 const modal=directory.locator('dialog.os-directory-dialog');
 await expect(modal).toBeVisible();
 await expect(modal.locator('#os-directory-dialog-title')).toHaveText('ยืนยันปิดสิทธิ์การใช้งาน');
 await expect(modal.locator('.os-directory-dialog-info')).toContainText(manager.displayName);
 await expect(modal.locator('select.os-directory-role')).not.toBeVisible();
 await expect(modal.locator('.os-directory-warning')).toContainText('ไม่ลบบัญชี Auth');
 await expect(modal.locator('.os-directory-warning')).toContainText('ประวัติเติมน้ำมัน');
 await expect(modal.locator('.os-directory-warning')).toContainText('เงินเดือน');
 await expect(modal.getByRole('button',{name:'ยืนยันปิดสิทธิ์'})).toBeVisible();
 console.log('QA_CASE '+CASE+' CONFIRM_UI_PASS: clear irreversible-impact warning and proper owner action');
 await modal.getByRole('button',{name:'ยกเลิก'}).click();
 await expect(modal).not.toBeVisible();
 expect(writes,'cancel must issue no account mutation').toEqual([]);
 console.log('QA_CASE '+CASE+' CANCEL_PASS: closed without POST');

 const after=await page.request.get(membersUrl,{headers});
 expect(after.status()).toBe(200);
 const same=(await after.json()).members.find(x=>x.membershipId===manager.membershipId);
 expect(same).toBeTruthy();
 expect(same.active,'member stays active after cancel').toBe(true);
 expect(same.role,'role remains manager').toBe('manager');
 await expect(row.locator('.os-directory-state')).toHaveAttribute('data-state','active');
 console.log('QA_CASE '+CASE+' UNCHANGED_PASS: real API and UI member still active');

 await search.fill(owner.email||owner.displayName);
 const ownerRow=directory.locator('tbody tr').filter({hasText:owner.email||owner.displayName});
 await expect(ownerRow).toHaveCount(1);
 await expect(ownerRow.locator('.os-directory-protected')).toContainText('บัญชีที่ได้รับการป้องกัน');
 await expect(ownerRow.locator('button[aria-label^="ปิดสิทธิ์"]')).toHaveCount(0);
 expect(writes).toEqual([]);
 expect(jsErrors).toEqual([]);
 console.log('QA_CASE '+CASE+' OWNER_PROTECTED_PASS: station owner cannot be deactivated from UI');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + CONFIRM_UI_PASS + CANCEL_PASS + UNCHANGED_PASS + OWNER_PROTECTED_PASS + NO_WRITES');
});
