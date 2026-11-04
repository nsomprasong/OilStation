import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../src/client/workspace-layout.js';

const source=readFileSync(new URL('../src/client/member-invitations.js',import.meta.url),'utf8')
 .replace("import {makeIcon} from './icons.js';",`const makeIcon=name=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','19');svg.setAttribute('height','19');
  svg.setAttribute('aria-hidden','true');
  svg.dataset.icon=name;return svg;
 };`)
 .replace("import {mountMemberDirectory} from './member-directory.js';",
   "const mountMemberDirectory=()=>null;")
 .replace('export function mountMemberInvitations','function mountMemberInvitations')+
 '\nwindow.mountMemberInvitations=mountMemberInvitations;';

async function mount(page,{qa=true,readonly=false}={}){
 await page.goto('/');
 const scope=[{scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'qa-company'}];
 await page.evaluate(markup=>{
  const app=document.getElementById('app');
  app.className='workspace-mode';
  app.innerHTML=markup;
  const shell=app.querySelector('[data-workspace-shell]');
  shell.dataset.activeScreen='invitations';
  for(const s of app.querySelectorAll('[data-ws-screen]'))
   s.hidden=s.dataset.wsScreen!=='invitations';
  for(const g of app.querySelectorAll('[data-context-for]'))
   g.hidden=g.dataset.contextFor!=='invitations';
 },renderWorkspaceShell(selectWorkspaceScreens(scope)));
 await page.addScriptTag({content:source});
 await page.evaluate(({qa,readonly})=>{
  const host=document.getElementById('member-invites');
  if(readonly){
   window.mountMemberInvitations({target:host,
    readOnlyMessage:'Sales ไม่มีสิทธิ์เพิ่มพนักงานของบริษัท'});
   return;
  }
  const invite=document.createElement('div');
  invite.className='invite-control';
  invite.innerHTML='<button type="button">เชิญสมาชิก</button>'+
   '<form class="invite-form" hidden>'+
   '<label class="field">อีเมลผู้รับคำเชิญ<input type="email" required placeholder="อีเมล"></label>'+
   '<label class="field">บทบาท<select><option>ผู้ออกคูปอง</option></select></label>'+
   '<button class="button primary" type="submit">สร้างคำเชิญ</button>'+
   '</form>';
  let qaHost=null;
  if(qa){
   qaHost=document.createElement('div');
   qaHost.className='os-qa-admin-host';
   qaHost.innerHTML='<section class="os-qa-admin"><div class="os-qa-expanded">'+
    '<h3>เพิ่มพนักงานบริษัทของฉัน</h3>'+
    '<p class="os-qa-note">สร้างบัญชี QA ภายในสิทธิ์บริษัทนี้เท่านั้น</p>'+
    '<form class="os-qa-form">'+
    '<label>ชื่อบัญชีทดสอบ<input value="c01-issuer"></label>'+
    '<label>รหัสผ่านทดสอบ<input type="password" minlength="16"></label>'+
    '<button class="button primary" type="submit">สร้างบัญชีทดสอบ</button>'+
    '</form></div></section>';
  }
  window.mountMemberInvitations({target:host,inviteControl:invite,qaHost});
 },{qa,readonly});
}

test('Invitation landing is one quiet list-first screen; drawer is optional and responsive',async({page},info)=>{
 for(const width of [320,390,1024,1440]){
  await page.setViewportSize({width,height:width<600?844:900});
  await mount(page);
  const pageRoot=page.locator('[data-ws-screen="invitations"]');
  await expect(pageRoot.locator('#ws-heading-invitations')).toHaveText('จัดการสมาชิก');
  await expect(pageRoot.locator('.os-member-list')).toBeVisible();
  await expect(pageRoot.locator('.os-member-toolbar-title')).toHaveText('เชิญและจัดการสิทธิ์');
  await expect(pageRoot.locator('.os-member-list-head')).toBeVisible();
  await expect(pageRoot.locator('.os-member-empty')).toContainText('ยังไม่มีรายการใหม่');
  await expect(pageRoot.locator('.os-member-create')).toHaveCount(1);
  await expect(pageRoot.locator('.os-add-fab')).toHaveCount(0);
  await expect(pageRoot.locator('.os-member-drawer')).toBeHidden();
  const metrics=await page.evaluate(()=>({
    w:document.documentElement.scrollWidth,
    v:document.documentElement.clientWidth,
    bg:getComputedStyle(document.querySelector('.os-member-list')).backgroundColor,
    heroGradient:getComputedStyle(document.querySelector('.os-member-toolbar')).backgroundImage,
    cardGradient:getComputedStyle(document.querySelector('.os-member-list')).backgroundImage,
    headerGradient:getComputedStyle(document.querySelector('.os-member-list-head')).backgroundImage,
    emptyGradient:getComputedStyle(document.querySelector('.os-member-empty')).backgroundImage,
    createBg:getComputedStyle(document.querySelector('.os-member-create')).backgroundImage,
    heroText:getComputedStyle(document.querySelector('.os-member-toolbar-title')).color,
    heroB:document.querySelector('.os-member-toolbar').getBoundingClientRect().bottom,
    listT:document.querySelector('.os-member-list').getBoundingClientRect().top,
    toolbar:getComputedStyle(document.querySelector('.ws-header')).display,
  }));
  expect(metrics.w,width+'px page width').toBeLessThanOrEqual(metrics.v+2);
  expect(metrics.bg).toBe('rgb(249, 248, 244)');
  for(const k of ['heroGradient','cardGradient','headerGradient','emptyGradient','createBg'])
   expect(metrics[k],k+' at '+width+'px').toContain('linear-gradient(');
  expect(metrics.heroText).toBe('rgb(255, 255, 255)');
  expect(metrics.listT-metrics.heroB).toBeGreaterThanOrEqual(14);
  expect(metrics.toolbar).toBe('none');
  await pageRoot.locator('.os-member-create').click();
  await expect(pageRoot.locator('.os-member-drawer')).toBeVisible();
  await expect(pageRoot.locator('.os-member-drawer .invite-form')).toBeVisible();
  await expect(pageRoot.locator('.os-member-drawer .invite-control>button')).toBeHidden();
  await expect(pageRoot.locator('.os-member-kind-tab')).toHaveCount(2);
  const dialog=await page.evaluate(()=>{
   const el=document.querySelector('.os-member-drawer'),r=el.getBoundingClientRect();
   return {w:r.width,h:r.height,viewport:innerWidth,active:document.activeElement.tagName};
  });
  if(width<600)expect(dialog.w).toBeGreaterThanOrEqual(width-2);
  else expect(dialog.w).toBeLessThanOrEqual(560);
  expect(dialog.h).toBeGreaterThan(750);
  if([390,1440].includes(width))
   await page.screenshot({path:info.outputPath('member-drawer-'+width+'.png'),animations:'disabled'});
  await page.keyboard.press('Escape');
  await expect(pageRoot.locator('.os-member-drawer')).toBeHidden();
 }
});
test('Only verified creation feedback becomes a recent item; QA and real invitation remain distinct',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mount(page);
 const root=page.locator('[data-ws-screen="invitations"]');
 await root.locator('.os-member-create').click();
 await page.locator('.os-member-kind-tab').nth(0).focus();
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('.os-member-kind-tab').nth(1)).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.os-member-kind-panel[data-member-kind="qa"]')).toBeVisible();
 await page.locator('.os-member-drawer').evaluate(el=>
  el.dispatchEvent(new CustomEvent('oilstation:member-created',{bubbles:true,
   detail:{kind:'qa',name:'c01-issuer',role:'ผู้ออกคูปอง'}})));
 await expect(page.locator('.os-member-count')).toHaveText('1 รายการ');
 await expect(page.locator('.os-member-record')).toContainText('c01-issuer');
 await expect(page.locator('.os-member-record')).toContainText('สร้างบัญชีแล้ว');
 // Native showModal() correctly makes the underlying list inert. Dismiss
 // the drawer before interacting with its sibling search input.
 await page.keyboard.press('Escape');
 await expect(page.locator('.os-member-drawer')).toBeHidden();
 await page.locator('.os-member-search').fill('ไม่พบ');
 await expect(page.locator('.os-member-empty')).toContainText('ไม่พบรายการที่ค้นหา');
 await page.locator('.os-member-search').fill('');
 await page.locator('.os-member-create').click();
 await page.locator('.os-member-drawer').evaluate(el=>
  el.dispatchEvent(new CustomEvent('oilstation:member-created',{bubbles:true,
   detail:{kind:'invitation',name:'demo@qa.oilstation.invalid',role:'ผู้ออกคูปอง'}})));
 await expect(page.locator('.os-member-count')).toHaveText('2 รายการ');
 await expect(page.locator('.os-member-record')).toHaveCount(2);
 await expect(page.locator('.os-member-record').first()).toContainText('สร้างคำเชิญแล้ว');
 await expect(page.locator('.os-member-list-head')).toContainText('ไม่ใช่รายชื่อสมาชิกทั้งหมด');
});
test('Sales read-only view never exposes invitation or QA account creation',async({page})=>{
 await mount(page,{readonly:true});
 await expect(page.locator('.os-member-readonly')).toContainText('ไม่มีสิทธิ์');
 await expect(page.locator('.os-member-create')).toHaveCount(0);
 await expect(page.locator('.os-member-drawer')).toHaveCount(0);
});

test('Live member directory is compact, searchable, role-scoped and safe on phones @public',async({page})=>{
 const directoryScript=readFileSync(new URL('../src/client/member-directory.js',import.meta.url),'utf8')
  .replace("import {makeIcon} from './icons.js';",`const makeIcon=name=>{
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('aria-hidden','true');svg.dataset.icon=name;return svg;
  };`)
  .replace('export const memberRoleLabel=','const memberRoleLabel=')
  .replace('export function mountMemberDirectory','function mountMemberDirectory')+
  '\\nwindow.mountMemberDirectory=mountMemberDirectory;';
 const accounts=[
  {membershipId:'a1',displayName:'QA c01-accountant',email:'qa-c01-accountant@qa.oilstation.invalid',role:'accountant',active:true,joinedAt:'2026-11-01T01:00:00Z'},
  {membershipId:'a2',displayName:'QA c01-admin',email:'qa-c01-admin@qa.oilstation.invalid',role:'corporate_admin',active:true,joinedAt:'2026-11-01T02:00:00Z'},
  {membershipId:'a3',displayName:'QA c01-driver',email:'qa-c01-driver@qa.oilstation.invalid',role:'driver',active:true,joinedAt:'2026-11-01T03:00:00Z'},
  {membershipId:'a4',displayName:'QA c01-finance',email:'qa-c01-finance@qa.oilstation.invalid',role:'finance_manager',active:true,joinedAt:'2026-11-01T04:00:00Z'},
  {membershipId:'a5',displayName:'QA c01-issuer',email:'qa-c01-issuer@qa.oilstation.invalid',role:'coupon_issuer',active:true,joinedAt:'2026-11-01T05:00:00Z'},
 ];
 const changes=[];
 await page.route('**/api/members/**',async route=>{
  const request=route.request();
  if(request.method()==='GET'){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({members:accounts})});
  }
  const data=request.postDataJSON();changes.push(data);
  if(data.membershipId==='a3'&&data.action==='deactivate'){
   return route.fulfill({status:409,contentType:'application/json',
    body:JSON.stringify({error:'driver_has_active_coupon'})});
  }
  if(data.membershipId==='a1'&&data.action==='edit'){
   accounts[0].role=data.roleCode;
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({result:{success:true}})});
  }
  return route.fulfill({status:403,contentType:'application/json',
   body:JSON.stringify({error:'permission_denied'})});
 });
 for(const width of [320,390,1024,1440]){
  await page.setViewportSize({width,height:width<600?844:900});
  await mount(page);
  await page.addScriptTag({content:directoryScript});
  await page.evaluate(()=>{
   const host=document.createElement('div');host.className='os-member-directory-host';
   document.querySelector('.os-member-list').append(host);
   window.mountMemberDirectory({target:host,token:'mock-authorized',
    scopeType:'corporate_company',scopeId:'mock-corp',canChange:true});
  });
  const root=page.locator('.os-member-directory-host');
  await expect(root.locator('tbody tr')).toHaveCount(5);
  await expect(root.locator('tbody')).toContainText('ผู้ดูแลบริษัท');
  await expect(root.locator('tr').filter({hasText:'QA c01-admin'}).locator('.os-directory-protected'))
   .toContainText('บัญชีที่ได้รับการป้องกัน');
  const dimensions=await page.evaluate(()=>({
   page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
   table:document.querySelector('.os-directory-scroll').scrollWidth,
   container:document.querySelector('.os-directory-scroll').clientWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport+2);
  if(width===320)expect(dimensions.table).toBeGreaterThan(dimensions.container);
  await root.locator('.os-directory-search').fill('driver');
  await expect(root.locator('tbody tr')).toHaveCount(1);
  await root.locator('.os-directory-search').fill('');
  await root.locator('.os-directory-filter').first().selectOption('corporate_admin');
  await expect(root.locator('tbody tr')).toHaveCount(1);
  await root.locator('.os-directory-filter').first().selectOption('all');
  await root.locator('.os-directory-filter').nth(1).selectOption('inactive');
  await expect(root.locator('.os-directory-empty')).toContainText('ไม่พบ');
  await root.locator('.os-directory-filter').nth(1).selectOption('all');
  if(width===1440){
   await root.getByRole('button',{name:'ปิดสิทธิ์ QA c01-driver'}).click();
   await expect(root.locator('.os-directory-dialog')).toBeVisible();
   await root.locator('.os-directory-dialog .button.destructive').click();
   await expect(root.locator('.os-directory-notice')).toContainText('คนขับยังมีคูปอง');
   await root.locator('.os-directory-dialog .button.secondary').click();
   await root.getByRole('button',{name:'แก้ไขบทบาท QA c01-accountant'}).click();
   await root.locator('.os-directory-role').selectOption('finance_manager');
   await root.locator('.os-directory-dialog .button.primary').click();
   await expect(root.locator('.os-directory-dialog')).toBeHidden();
   await expect(root.locator('tbody')).toContainText('ผู้จัดการการเงิน');
   expect(changes.at(-1)).toEqual({membershipId:'a1',action:'edit',roleCode:'finance_manager'});
  }
 }
});
