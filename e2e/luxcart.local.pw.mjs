import {test,expect} from '@playwright/test';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../src/client/workspace-layout.js';

test('LuxCart responsive guest login on the branch preview @luxcart',async({page},info)=>{
 const failures=[];
 page.on('pageerror',error=>failures.push(error.message));
 for(const width of [360,390,430,1280]){
  await page.setViewportSize({width,height:width===1280?800:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  const style=await page.evaluate(()=>{
   const hero=document.querySelector('.os-auth-hero');
   const title=document.querySelector('.os-auth-hero h1');
   const provider=document.querySelector('.os-auth-provider');
   return {
    hero:getComputedStyle(hero).backgroundColor,
    headingFont:getComputedStyle(title).fontFamily,
    providerRadius:getComputedStyle(provider).borderTopLeftRadius,
    viewport:document.documentElement.clientWidth,
    documentWidth:document.documentElement.scrollWidth,
    providerRight:provider.getBoundingClientRect().right,
   };
  });
  expect(style.hero,'cream login hero at '+width).toBe('rgb(255, 251, 235)');
  expect(style.headingFont).toContain('Cormorant Garamond');
  expect(style.providerRadius).toBe('2px');
  expect(style.documentWidth,'horizontal login overflow at '+width).toBeLessThanOrEqual(style.viewport+2);
  expect(style.providerRight).toBeLessThanOrEqual(style.viewport+2);
  await page.screenshot({path:info.outputPath('luxcart-login-'+width+'.png'),animations:'disabled'});
 }
 expect(failures).toEqual([]);
});

test('LuxCart role-filtered workspace retains five dock positions and restrained surfaces @luxcart',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('#app.auth-mode')).toBeVisible();
 const screens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]);
 await page.evaluate(markup=>{
  const app=document.getElementById('app');
  app.className='workspace-mode';
  app.innerHTML=markup;
 },renderWorkspaceShell(screens));
 await expect(page.locator('#app.workspace-mode .os-mobile-home')).toBeVisible();
 const dock=page.locator('#app.workspace-mode .os-mobile-bottom');
 await expect(dock).toBeVisible();
 await expect(dock.locator('.os-mobile-tab')).toHaveCount(5);
 await expect(page.locator('#app.workspace-mode .os-mobile-hero')).toBeVisible();
 const data=await page.evaluate(()=>{
  const nav=document.querySelector('.os-nav-orb');
  const hero=document.querySelector('.os-mobile-hero');
  const dock=document.querySelector('.os-mobile-bottom');
  return {
   navRadius:getComputedStyle(nav).borderTopLeftRadius,
   navColor:getComputedStyle(nav).color,
   background:getComputedStyle(hero).backgroundColor,
   dockBackground:getComputedStyle(dock).backgroundColor,
   viewport:document.documentElement.clientWidth,
   documentWidth:document.documentElement.scrollWidth
  };
 });
 expect(data.navRadius).toBe('4px');
 expect(data.background).toBe('rgb(255, 251, 235)');
 expect(data.dockBackground).toBe('rgb(255, 255, 255)');
 expect(data.documentWidth).toBeLessThanOrEqual(data.viewport+2);
 await page.screenshot({path:info.outputPath('luxcart-workspace-mobile.png'),animations:'disabled'});

 await page.setViewportSize({width:1440,height:900});
 const desktop=await page.evaluate(()=>{
  const first=document.querySelector('.ws-quick');
  return {
   background:getComputedStyle(document.getElementById('app')).backgroundColor,
   card:getComputedStyle(first).backgroundColor,
   radius:getComputedStyle(first).borderTopLeftRadius,
   gridColumns:getComputedStyle(document.querySelector('.ws-quick-grid')).gridTemplateColumns.split(' ').length,
   viewport:document.documentElement.clientWidth,
   page:document.documentElement.scrollWidth
  };
 });
 expect(desktop.background).toBe('rgb(255, 251, 235)');
 expect(desktop.card).toBe('rgb(255, 255, 255)');
 expect(desktop.radius).toBe('4px');
 expect(desktop.gridColumns).toBeLessThanOrEqual(3);
 expect(desktop.page).toBeLessThanOrEqual(desktop.viewport+2);
 await page.screenshot({path:info.outputPath('luxcart-workspace-desktop.png'),animations:'disabled'});
});

test('LuxCart Sales desktop and mobile use one coherent non-teal workspace @luxcart',async({page},info)=>{
 const salesScreens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_sales'}]);
 await page.setViewportSize({width:1230,height:915});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(markup=>{
   const app=document.querySelector('#app');
   app.className='workspace-mode';
   app.innerHTML=markup;
   const shell=app.querySelector('.ws-layout');
   shell.dataset.activeScreen='sales';
   app.querySelector('[data-ws-screen="overview"]').hidden=true;
   app.querySelector('[data-ws-screen="sales"]').hidden=false;
   app.querySelector('[data-context-for="sales"]').hidden=false;
   app.querySelector('#platform-sales-workspace').innerHTML=
    '<div class="os-sales-workspace">'+
    '<div class="os-sales-head"><h3>ปั๊มที่รับผิดชอบ</h3>'+
    '<button type="button" class="button secondary">รีเฟรช</button></div>'+
    '<section class="os-sales-panel"><h4>ปั๊มที่รับผิดชอบ</h4>'+
    '<div class="os-sales-grid"><article class="os-sales-card"><strong>สถานีทดสอบ 1</strong>'+
    '<p>สถานะตัวอย่างสำหรับตรวจธีมเท่านั้น</p></article>'+
    '<article class="os-sales-card"><strong>สถานีทดสอบ 2</strong>'+
    '<p>ข้อมูลจำลองที่ไม่เชื่อมต่อฐานข้อมูล</p></article></div></section></div>';
 },renderWorkspaceShell(salesScreens));

 const desktop=await page.evaluate(()=>{
  const css=(sel)=>getComputedStyle(document.querySelector(sel));
  const dock=document.querySelector('.os-mobile-bottom').getBoundingClientRect();
  return {
   mainBg:css('.ws-main').backgroundColor,
   headerBg:css('[data-ws-screen="sales"] .ws-screen-head').backgroundColor,
   headerImage:css('[data-ws-screen="sales"] .ws-screen-head').backgroundImage,
   headerRadius:css('[data-ws-screen="sales"] .ws-screen-head').borderTopLeftRadius,
   headingColor:css('[data-ws-screen="sales"] .ws-screen-head h2').color,
   cardBg:css('.os-sales-card').backgroundColor,
   dockBg:css('.os-mobile-bottom').backgroundColor,
   dockLeft:Math.round(dock.left),
   dockWidth:Math.round(dock.width),
   viewport:document.documentElement.clientWidth,
   docWidth:document.documentElement.scrollWidth,
  };
 });
 expect(desktop.mainBg).toBe('rgb(255, 251, 235)');
 expect(desktop.headerBg).toBe('rgba(0, 0, 0, 0)');
 expect(desktop.headerImage).toBe('none');
 expect(desktop.headerRadius).toBe('0px');
 expect(desktop.headingColor).toBe('rgb(28, 25, 23)');
 expect(desktop.cardBg).toBe('rgb(255, 255, 255)');
 expect(desktop.dockBg).toBe('rgb(255, 255, 255)');
 expect(desktop.dockLeft).toBe(0);
 expect(desktop.dockWidth).toBe(desktop.viewport);
 expect(desktop.docWidth).toBeLessThanOrEqual(desktop.viewport+2);
 await page.screenshot({path:info.outputPath('luxcart-sales-desktop-1230.png'),animations:'disabled'});

 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{
  const top=document.querySelector('.ws-header');
  const dock=document.querySelector('.os-mobile-bottom');
  return {
   headerBg:getComputedStyle(top).backgroundColor,
   dockBg:getComputedStyle(dock).backgroundColor,
   dockSlots:dock.querySelectorAll('.os-mobile-tab').length,
   viewport:document.documentElement.clientWidth,
   docWidth:document.documentElement.scrollWidth,
  };
 });
 expect(mobile.headerBg).toBe('rgb(255, 251, 235)');
 expect(mobile.dockBg).toBe('rgb(255, 255, 255)');
 expect(mobile.dockSlots).toBe(5);
 expect(mobile.docWidth).toBeLessThanOrEqual(mobile.viewport+2);
 await page.screenshot({path:info.outputPath('luxcart-sales-mobile-390.png'),animations:'disabled'});
});

test('LuxCart shell keeps all principal role scopes readable on mobile and desktop @luxcart',async({page},info)=>{
 const roles=[
  ['platform-superadmin',[{scopeType:'platform',role:'platform_superadmin'}]],
  ['platform-sales',[{scopeType:'platform',role:'platform_sales'}]],
  ['platform-support',[{scopeType:'platform',role:'platform_support'}]],
  ['station-owner',[{scopeType:'station',role:'station_owner',stationId:'qa-station'}]],
  ['station-cashier',[{scopeType:'station',role:'cashier',stationId:'qa-station'}]],
  ['corporate-admin',[{scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'qa-company'}]],
  ['corporate-driver',[{scopeType:'corporate_company',role:'driver',corporateCompanyId:'qa-company'}]],
 ];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:900});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  for(const [label,memberships] of roles){
   const screens=selectWorkspaceScreens(memberships);
   const dest=screens.find(s=>s.key!=='overview');
   expect(dest,'at least one authorized task for '+label).toBeTruthy();
   const html=renderWorkspaceShell(screens);
   await page.evaluate(({html,dest})=>{
    const app=document.querySelector('#app');
    app.className='workspace-mode';
    app.innerHTML=html;
    app.querySelector('.ws-layout').dataset.activeScreen=dest;
    for(const node of app.querySelectorAll('[data-ws-screen]'))node.hidden=node.dataset.wsScreen!==dest;
    for(const node of app.querySelectorAll('[data-context-for]'))node.hidden=node.dataset.contextFor!==dest;
    const container=app.querySelector('[data-ws-screen="'+dest+'"] .ws-widget');
    if(container)container.innerHTML='<section class="os-sales-panel">'+
     '<h3>ตัวอย่างรายการทำงาน</h3><label class="field">ข้อมูลทดสอบ'+
     '<input aria-label="ข้อมูลทดสอบ" placeholder="กรอกข้อมูล"></label>'+
     '<button class="button primary" type="button">ยืนยัน</button></section>';
   },{html,dest:dest.key});
   const state=await page.evaluate(()=>{
    const css=s=>getComputedStyle(document.querySelector(s));
    return {
     screenImage:css('[data-ws-screen]:not([hidden]) .ws-screen-head').backgroundImage,
     screenColor:css('[data-ws-screen]:not([hidden]) .ws-screen-head h2').color,
     canvas:css('#app.workspace-mode').backgroundColor,
     dockSlots:document.querySelectorAll('.os-mobile-bottom .os-mobile-tab').length,
     width:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth,
     dockBg:css('.os-mobile-bottom').backgroundColor,
    };
   });
   expect(state.canvas,label+' canvas '+width).toBe('rgb(255, 251, 235)');
   expect(state.screenImage,label+' gradient '+width).toBe('none');
   expect(state.screenColor,label+' text '+width).toBe('rgb(28, 25, 23)');
   expect(state.dockSlots,label+' role '+width).toBe(5);
   expect(state.dockBg).toBe('rgb(255, 255, 255)');
   expect(state.width,label+' overflow '+width).toBeLessThanOrEqual(state.viewport+2);
   if(['station-owner','corporate-admin','platform-sales'].includes(label))
    await page.screenshot({path:info.outputPath('luxcart-'+label+'-'+width+'.png'),animations:'disabled'});
  }
 }
});
