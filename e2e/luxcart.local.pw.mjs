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
