import {test,expect} from '@playwright/test';

// OS-QA-ST-MEMBER-DIRECTORY-005: one existing station owner, one mobile
// invitations/member-directory task. Read-only: no member edits or invites.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-MEMBER-DIRECTORY-005';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected sequential one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('QA review Secret unavailable');
});
test(CASE+': station member table, role/email/name search and guard @qa-one-case',async({page})=>{
 test.setTimeout(105_000);
 const writes=[],jsErrors=[];
 page.on('pageerror',()=>jsErrors.push('javascript_exception'));
 page.on('request',req=>{
  try{
   const url=new URL(req.url());
   if(url.origin===BASE&&url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method()))
    writes.push(url.pathname);
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
 console.log('QA_CASE '+CASE+' AUTH_PASS: s01b station only');

 const directoryResponse=await page.request.get(BASE+'/api/members/directory?'+
  new URLSearchParams({scopeType:'station',scopeId:STATION}),{headers});
 if(directoryResponse.status()!==200)console.log('QA_CASE '+CASE+' API_BLOCKED: member directory HTTP '+directoryResponse.status());
 expect(directoryResponse.status(),'scoped live member directory must permit this station owner').toBe(200);
 const members=(await directoryResponse.json()).members;
 expect(Array.isArray(members)).toBe(true);
 expect(members.length,'existing station must have at least its owner').toBeGreaterThan(0);
 console.log('QA_CASE '+CASE+' API_PASS: scoped member directory available');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first();
 await expect(tile).toBeVisible({timeout:14_000});
 await tile.click();
 const screen=page.locator('[data-ws-screen="invitations"]:visible');
 await expect(screen).toBeVisible({timeout:12_000});
 const directory=screen.locator('.os-member-directory-host');
 await expect(directory.locator('table.os-directory-table')).toBeVisible({timeout:14_000});
 const search=directory.locator('input.os-directory-search');
 await expect(search).toHaveCount(1);
 await expect(search).toHaveAttribute('placeholder','ค้นหาชื่อ อีเมล หรือบทบาท');
 await expect(directory.locator('.os-directory-search-wrap .os-directory-search-submit')).toHaveCount(1);
 await expect(directory.locator('.os-member-search:visible')).toHaveCount(0);
 const rows=directory.locator('table.os-directory-table tbody tr');
 await expect(rows).toHaveCount(members.length,{timeout:14_000});
 await expect(screen.locator('.os-member-count')).toHaveText(members.length+' รายการ');
 console.log('QA_CASE '+CASE+' DIRECTORY_PASS: real scoped rows, one search and table');

 const target=members.find(m=>typeof m.email==='string'&&m.email.trim());
 expect(target,'a station member has a searchable email').toBeTruthy();
 const q=target.email.trim();
 const expected=members.filter(m=>[m.displayName,m.email,
   ({station_owner:'เจ้าของสถานี',owner:'เจ้าของบัญชี',manager:'ผู้จัดการ',
     cashier:'แคชเชียร์',attendant:'พนักงานปั๊ม',pump_staff:'พนักงานหน้าลาน',
     hr_manager:'ผู้จัดการฝ่ายบุคคล',finance_manager:'ผู้จัดการการเงิน'})[m.role]||m.role]
   .join(' ').toLocaleLowerCase('th').includes(q.toLocaleLowerCase('th'))).length;
 await search.fill(q);
 await expect(rows).toHaveCount(expected);
 await expect(directory.locator('tbody')).toContainText(q);
 console.log('QA_CASE '+CASE+' SEARCH_PASS: existing email filters source-backed directory');
 await search.fill('QA-NO-MEMBER-MATCH-005-UNLIKELY');
 await expect(directory.locator('td.os-directory-empty')).toHaveText('ไม่พบสมาชิกที่ตรงกับตัวกรอง');
 await search.fill('');
 await expect(rows).toHaveCount(members.length);
 console.log('QA_CASE '+CASE+' EMPTY_AND_RESET_PASS: empty search and restore');

 expect(writes,'no member/invite change API calls').toEqual([]);
 expect(jsErrors,'no uncaught client errors').toEqual([]);
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + API_PASS + DIRECTORY_PASS + SEARCH_PASS + EMPTY_AND_RESET_PASS + NO_WRITES');
});
