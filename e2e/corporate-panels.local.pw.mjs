import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../src/client/workspace-layout.js';

// Layout-only fixture built from the actual corporate template. This suite
// never signs in, queries Supabase, or writes customer wallet/coupon records.
const main=readFileSync(new URL('../src/client/main.js',import.meta.url),'utf8');
const index=main.indexOf('async function corporateWorkspace');
const start=main.indexOf('target.innerHTML = `',index);
const end=main.indexOf('`;\n  const $ = id',start);
if(start<0||end<start)throw new Error('Corporate template not found');
const corporateMarkup=main.slice(start+'target.innerHTML = `'.length,end);
if(corporateMarkup.includes('${'))throw new Error('Template has dynamic data; test fixture needs a safe parser');
const activeMarker=readFileSync(new URL('../src/client/moving-active-highlight.js',import.meta.url),'utf8')
 .replace('export function installMovingActiveHighlight','function installMovingActiveHighlight');
const submenus=activeMarker+'\n'+readFileSync(new URL('../src/client/functional-submenus.js',import.meta.url),'utf8')
 .replace("import {makeIcon} from './icons.js';",`const makeIcon=name=>{
  const el=document.createElementNS('http://www.w3.org/2000/svg','svg');
  el.setAttribute('aria-hidden','true');
  el.setAttribute('width','18');el.setAttribute('height','18');
  el.style.pointerEvents='none';el.dataset.icon=name;return el;};`)
 .replace("import {installMovingActiveHighlight} from './moving-active-highlight.js';",'')
 .replace('export function installFunctionalSubmenus','function installFunctionalSubmenus')+
 ';window.installFunctionalSubmenus=installFunctionalSubmenus;';

async function mount(page){
 await page.goto('/');
 await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
 const shell=renderWorkspaceShell(selectWorkspaceScreens([
  {scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'fixture-company'}
 ]));
 await page.evaluate(({shell,markup})=>{
  const app=document.getElementById('app');
  app.className='workspace-mode';app.innerHTML=shell;
  const workspace=app.querySelector('[data-workspace-shell]');
  workspace.dataset.activeScreen='corporate';
  for(const s of app.querySelectorAll('[data-ws-screen]'))s.hidden=s.dataset.wsScreen!=='corporate';
  for(const s of app.querySelectorAll('[data-context-for]'))s.hidden=s.dataset.contextFor!=='corporate';
  const root=app.querySelector('#corporate-workspace');
  root.innerHTML=markup;
  root.querySelector('#corp-help').textContent='ยอดพร้อมใช้หลังหักวงเงินที่กันไว้';
  root.querySelector('#corp-remaining-credit').textContent='บัญชีที่เลือก — รายการทดสอบการจัดวาง';
  root.querySelector('#account-overview').innerHTML=
   '<article class="balance-card"><strong>บัญชีทดสอบการจัดวาง</strong>'+
   '<div class="money">—</div><span>ยอดพร้อมใช้</span>'+
   '<button class="button secondary wallet-check-button" type="button">ตรวจยอดจองคูปองและลูกหนี้</button></article>';
  root.querySelector('#topup-upload-form').hidden=true;
  root.querySelector('#qa-topup-workspace').hidden=true;
  const driver=root.querySelector('#company-driver-workspace');
  driver.hidden=false;
  driver.innerHTML='<h3 class="section-title">กำหนดรถประจำคนขับ</h3>'+
   '<p class="hint">กำหนดทะเบียนรถที่คนขับใช้งานก่อนออก QR</p>'+
   '<form class="coupon-form">'+
   '<label class="field">เลือกพนักงานขับรถ<select><option>พนักงานทดสอบ</option></select></label>'+
   '<label class="field">ทะเบียนรถที่คนขับใช้งาน<input value="QA TEST"></label>'+
   '<button class="button primary" type="button">ผูกทะเบียนกับคนขับ</button>'+
   '<p class="hint" role="status">เลือกคนขับและกำหนดทะเบียนรถ</p></form>'+
   '<div class="module-list"><div class="module-item"><strong>พนักงานทดสอบ</strong>'+
   '<p class="module-subtitle">รถปัจจุบัน: QA TEST</p></div></div>';
  root.querySelector('#coupon-form').hidden=false;
  root.querySelector('#company-fuel-report').innerHTML=
   '<header class="os-report-header"><p>แสดงเฉพาะรายการเติมน้ำมันที่เสร็จสมบูรณ์ (ตัวอย่างการจัดวาง)</p></header>'+
   '<div class="os-report-filters"><label class="field">ทะเบียนรถ<input placeholder="ทะเบียนรถ"></label>'+
   '<button class="button secondary" type="button">ค้นหารายงาน</button></div>'+
   '<p class="os-report-notice" role="status">ไม่มีธุรกรรมจริงใน Fixture นี้</p>'+
   '<div class="os-report-summary"><strong>0 รายการ</strong><span>ยอดสุทธิ —</span></div>'+
   '<div class="os-report-table-scroll"><table class="os-report-table"><thead><tr>'+
   '<th>วันเวลา</th><th>บริษัท</th><th>ทะเบียนรถ</th><th>ชนิดน้ำมัน</th>'+
   '<th>ลิตร</th><th>ยอดสุทธิ</th></tr></thead><tbody></tbody></table></div>';
 },{shell,markup:corporateMarkup});
 await page.addScriptTag({content:'(()=>{'+submenus+'})()'});
 await page.evaluate(()=>{window.__submenu=window.installFunctionalSubmenus(document.getElementById('app'));});
 await expect(page.locator('[data-context-for="corporate"] [data-os-pane-key="coupon"]')).toBeVisible();
}
test('Corporate four working panels are balanced and follow selected page heading @public',async({page},info)=>{
 for(const width of [320,390,1024,1440]){
  await page.setViewportSize({width,height:width<600?844:900});
  await mount(page);
  const screen=page.locator('[data-ws-screen="corporate"]');
  const root=screen.locator('#corporate-workspace');
  const local=await page.evaluate(()=>['localhost','127.0.0.1'].includes(location.hostname));
  if(local)await expect(page.locator('.ws-layout[data-active-screen="corporate"] .ws-header')).toBeHidden();
  for(const [key,title] of [['account','บัญชีบริษัท'],['driver','รถและคนขับ'],
    ['coupon','ออกคูปอง'],['report','รายงานเติมน้ำมัน']]){
   await page.locator('[data-context-for="corporate"] [data-os-pane-key="'+key+'"]').click();
   await expect(screen.locator('.ws-screen-head h2')).toHaveText(title);
   await expect(screen.locator('.ws-screen-head p')).not.toBeEmpty();
   await expect(root.locator('.os-functional-pane:visible')).toHaveCount(1);
   const state=await page.evaluate(({key})=>{
    const css=el=>getComputedStyle(el);
    const driver=document.querySelector('#company-driver-workspace');
    const coupon=document.querySelector('#coupon-form');
    const heading=document.querySelector('[data-ws-screen="corporate"] .ws-screen-head');
    return {
     page:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth,
     driverGrid:css(driver).gridTemplateColumns.split(' ').length,
     couponGrid:css(coupon).gridTemplateColumns.split(' ').length,
     headingBg:css(heading).backgroundImage,
     paneInset:css(document.querySelector('#corporate-workspace>.os-functional-pane[data-os-pane="'+key+'"]')).paddingLeft,
     driverHintBorder:css(driver.querySelector(':scope > p.hint')).borderTopWidth,
     tab:key,
    };
   },{key});
   expect(state.page,key+' page overflow '+width).toBeLessThanOrEqual(state.viewport+2);
   if(local){
    expect(state.headingBg).toContain('linear-gradient(');
    expect(state.paneInset).toBe(width<=680?'12px':'16px');
    expect(state.driverHintBorder).toBe('0px');
    if(key==='driver')expect(state.driverGrid).toBe(width<=960?1:2);
    if(key==='coupon')expect(state.couponGrid).toBe(width<=680?1:2);
   }
   if(local&&[390,1440].includes(width))
    await page.screenshot({path:info.outputPath('corporate-'+key+'-'+width+'.png'),
     animations:'disabled',fullPage:true});
  }
  // Actual DOM panes remain mounted when switching: no lost form inputs.
  await page.locator('[data-context-for="corporate"] [data-os-pane-key="coupon"]').click();
  await root.locator('#amount-input').fill('1250');
  await page.locator('[data-context-for="corporate"] [data-os-pane-key="driver"]').click();
  await page.locator('[data-context-for="corporate"] [data-os-pane-key="coupon"]').click();
  await expect(root.locator('#amount-input')).toHaveValue('1250');
 }
});
