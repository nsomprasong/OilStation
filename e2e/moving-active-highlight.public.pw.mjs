import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../src/client/workspace-layout.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('public/oilstation.css');
const script=read('src/client/moving-active-highlight.js')+
 '\nwindow.__installMovingActiveHighlight=installMovingActiveHighlight;';
const screens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]);
async function mount(page){
 await page.goto('/');
 // Wait for asynchronous guest boot to finish before replacing DOM with a
 // no-login, no-financial-write navigation fixture.
 await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
 await page.evaluate(markup=>{
  const app=document.querySelector('#app');
  app.className='workspace-mode';
  app.innerHTML=markup;
  app.querySelector('#scope-title').textContent='QA selection animation';
 },renderWorkspaceShell(screens));
 await page.addStyleTag({content:css});
 await page.addScriptTag({type:'module',content:script});
 await page.waitForFunction(()=>typeof window.__installMovingActiveHighlight==='function');
 await expect(page.locator('.os-desktop-side-nav')).toHaveCount(1);
 await page.evaluate(()=>document.fonts?.ready);
}
const coords=async locator=>locator.boundingBox();

test('@public ANM-NAV-001 desktop highlight GLIDES between separate authorized sidebar items',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mount(page);
 await page.evaluate(()=>{
  const nav=document.querySelector('.os-desktop-side-nav');
  window.__sidebarHighlight=window.__installMovingActiveHighlight(nav,{
   selector:'.os-desktop-side-link[data-ws-go]',keyAttribute:'wsGo',layout:'vertical',
  });
  nav.addEventListener('click',e=>{
   const target=e.target.closest('button[data-ws-go]');
   if(!target)return;
   for(const item of nav.querySelectorAll('button[data-ws-go]')){
    const active=item===target;
    item.classList.toggle('is-current',active);
    if(active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
   }
   window.__sidebarHighlight.select(target.dataset.wsGo);
  });
  window.__sidebarHighlight.select('overview',{snap:true});
 });
 const marker=page.locator('.os-desktop-side-nav>.os-moving-active-indicator');
 const first=await coords(marker);
 await page.locator('.os-desktop-side-link[data-ws-go="sales"]').click();
 await page.waitForTimeout(140);
 const moving=await coords(marker);
 await page.waitForTimeout(540);
 const final=await coords(marker);
 const target=await coords(page.locator('.os-desktop-side-link[data-ws-go="sales"]'));
 expect(moving.y).toBeGreaterThan(first.y+2);
 expect(moving.y).toBeLessThan(final.y-2);
 expect(Math.abs(final.y-target.y)).toBeLessThan(2);
 expect(Math.abs(final.height-target.height)).toBeLessThan(2);
 await page.locator('.os-desktop-side-link[data-ws-go="sales"]').focus();
 await page.keyboard.press('ArrowDown');
 await expect(page.locator('.os-desktop-side-link[data-ws-go="activity"]')).toHaveAttribute('aria-current','page');
 await page.waitForTimeout(550);
 const after=await coords(marker);
 const activity=await coords(page.locator('.os-desktop-side-link[data-ws-go="activity"]'));
 expect(Math.abs(after.y-activity.y)).toBeLessThan(2);
});

test('@public horizontal dock travels A-to-B; contextual pill changes WIDTH and reduced motion snaps',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await mount(page);
 await page.evaluate(()=>{
  const dock=document.querySelector('.os-mobile-dock-inner');
  window.__dockHighlight=window.__installMovingActiveHighlight(dock,{
   selector:'.os-mobile-tab[data-ws-go]',keyAttribute:'wsGo',layout:'horizontal',
  });
  dock.addEventListener('click',e=>{
   const target=e.target.closest('button[data-ws-go]');
   if(!target)return;
   for(const b of dock.querySelectorAll('button[data-ws-go]')){
    b.classList.toggle('is-current',b===target);
    if(b===target)b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
   }
   window.__dockHighlight.select(target.dataset.wsGo);
  });
  window.__dockHighlight.select('overview',{snap:true});
 });
 const dockMarker=page.locator('.os-mobile-dock-inner>.os-moving-active-indicator');
 const before=await coords(dockMarker);
 await page.locator('.os-mobile-dock-inner button[data-ws-go="sales"]').click();
 await page.waitForTimeout(150);
 const during=await coords(dockMarker);
 await page.waitForTimeout(520);
 const after=await coords(dockMarker);
 expect(during.x).toBeGreaterThan(before.x+2);
 expect(during.x).toBeLessThan(after.x-2);
 const target=await coords(page.locator('.os-mobile-dock-inner button[data-ws-go="sales"]'));
 expect(Math.abs(after.x-target.x)).toBeLessThan(2);
 await page.evaluate(()=>{
  const host=document.querySelector('.ws-context-host');
  const tab=document.createElement('nav');
  tab.className='os-functional-nav';tab.setAttribute('aria-label','ทดสอบไฮไลต์เมนูย่อย');
  for(const [id,label] of [['one','รายงาน'],['two','การอนุมัติที่ต้องตรวจสอบ'],['three','ประวัติ']]){
   const b=document.createElement('button');b.className='os-category-tab';
   b.type='button';b.dataset.osPaneKey=id;b.textContent=label;
   b.setAttribute('aria-pressed',String(id==='one'));tab.append(b);
  }
  host.append(tab);
  window.__tabHighlight=window.__installMovingActiveHighlight(tab,{
   selector:'button[data-os-pane-key]',keyAttribute:'osPaneKey',layout:'horizontal',
  });
  tab.addEventListener('click',e=>{
   const b=e.target.closest('button[data-os-pane-key]');
   if(!b)return;
   for(const x of tab.querySelectorAll('button'))x.setAttribute('aria-pressed',String(x===b));
   window.__tabHighlight.select(b.dataset.osPaneKey);
  });
  window.__tabHighlight.select('one',{snap:true});
 });
 const tabMarker=page.locator('.os-functional-nav>.os-moving-active-indicator');
 const start=await coords(tabMarker);
 await page.locator('.os-functional-nav button[data-os-pane-key="two"]').click();
 await page.waitForTimeout(180);
 const middle=await coords(tabMarker);
 await page.waitForTimeout(500);
 const end=await coords(tabMarker);
 const second=await coords(page.locator('.os-functional-nav button[data-os-pane-key="two"]'));
 expect(end.width).toBeGreaterThan(start.width+8);
 expect(middle.width).toBeGreaterThan(start.width+2);
 expect(middle.width).toBeLessThan(end.width-2);
 expect(Math.abs(end.width-second.width)).toBeLessThan(2);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.os-functional-nav button[data-os-pane-key="three"]').click();
 const motion=await tabMarker.evaluate(el=>getComputedStyle(el).transitionDuration);
 expect(motion.split(',').every(value=>parseFloat(value)===0)).toBe(true);
 const snapped=await coords(tabMarker);
 const third=await coords(page.locator('.os-functional-nav button[data-os-pane-key="three"]'));
 expect(Math.abs(snapped.x-third.x)).toBeLessThan(2);
});
