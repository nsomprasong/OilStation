import {test,expect} from '@playwright/test';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../src/client/workspace-layout.js';

const memberships=[
 ['superadmin',[{scopeType:'platform',role:'platform_superadmin'}]],
 ['sales',[{scopeType:'platform',role:'platform_sales'}]],
 ['support',[{scopeType:'platform',role:'platform_support'}]],
 ['station-owner',[{scopeType:'station',role:'station_owner',stationId:'qa-station'}]],
 ['cashier',[{scopeType:'station',role:'cashier',stationId:'qa-station'}]],
 ['corporate-admin',[{scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'qa-company'}]],
 ['driver',[{scopeType:'corporate_company',role:'driver',corporateCompanyId:'qa-company'}]]
];
async function mountShell(page,role,screen='overview'){
 const screens=selectWorkspaceScreens(role);
 const selected=screens.some(x=>x.key===screen)?screen:'overview';
 await page.evaluate(({markup,selected})=>{
  const app=document.querySelector('#app');
  app.className='workspace-mode';
  app.innerHTML=markup;
  app.querySelector('[data-workspace-shell]').dataset.activeScreen=selected;
  for(const s of app.querySelectorAll('[data-ws-screen]'))s.hidden=s.dataset.wsScreen!==selected;
  for(const s of app.querySelectorAll('[data-context-for]'))s.hidden=s.dataset.contextFor!==selected;
  app.querySelector('#scope-title').textContent='แดชบอร์ด OilStation';
 },{markup:renderWorkspaceShell(screens),selected});
 return screens;
}
test('Midnight guest login renders dark at all breakpoints',async({page},info)=>{
 for(const width of [360,390,430,1280]){
  await page.setViewportSize({width,height:width===1280?800:844});
  await page.goto('/');
  await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  const state=await page.evaluate(()=>{
   const style=sel=>getComputedStyle(document.querySelector(sel));
   return {hero:style('.os-auth-hero').backgroundColor,card:style('.os-auth-card').backgroundColor,
    heading:style('.os-auth-hero h1').fontFamily,radius:style('.os-auth-provider').borderTopLeftRadius,
    width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
  });
  expect(state.hero).toBe('rgb(20, 28, 78)');
  expect(state.card).toBe('rgb(29, 37, 82)');
  expect(state.heading).toContain('Inter');
  expect(state.radius).toBe('8px');
  expect(state.width).toBeLessThanOrEqual(state.viewport+2);
  await page.screenshot({path:info.outputPath('midnight-login-'+width+'.png'),animations:'disabled'});
 }
});
test('Desktop is a real sidebar/topbar/dashboard grid, not a floating bottom dock',async({page},info)=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const screens=await mountShell(page,memberships[0][1]);
 await expect(page.locator('.os-desktop-sidebar')).toBeVisible();
 await expect(page.locator('.os-desktop-search')).toBeVisible();
 await expect(page.locator('.os-desktop-side-link')).toHaveCount(screens.length);
 await expect(page.locator('.ws-quick')).toHaveCount(screens.length-1);
 const state=await page.evaluate(()=>{
  const style=sel=>getComputedStyle(document.querySelector(sel));
  const rect=sel=>document.querySelector(sel).getBoundingClientRect();
  return {
   columns:style('.ws-layout').gridTemplateColumns.split(' ').length,
   sidebarWidth:rect('.os-desktop-sidebar').width,
   sidebarBg:style('.os-desktop-sidebar').backgroundColor,
   topBg:style('.ws-toolbar').backgroundColor,
   background:style('#app.workspace-mode').backgroundColor,
   card:style('.ws-quick').backgroundColor,
   grid:style('.ws-quick-grid').gridTemplateColumns.split(' ').length,
   dock:style('.os-mobile-bottom').display,
   width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth
  };
 });
 expect(state.columns).toBe(2);
 expect(state.sidebarWidth).toBeGreaterThan(200);
 expect(state.sidebarWidth).toBeLessThan(260);
 expect(state.sidebarBg).toBe('rgb(20, 28, 78)');
 expect(state.topBg).toBe('rgb(20, 28, 78)');
 expect(state.background).toBe('rgb(4, 13, 63)');
 expect(state.card).toBe('rgb(29, 37, 82)');
 expect(state.grid).toBe(3);
 expect(state.dock).toBe('none');
 expect(state.width).toBeLessThanOrEqual(state.viewport+2);
 await page.screenshot({path:info.outputPath('midnight-desktop-dashboard.png'),animations:'disabled',fullPage:true});
});
test('Sales desktop workspace keeps dark surfaces and authorized sidebar',async({page},info)=>{
 await page.setViewportSize({width:1230,height:900});
 await page.goto('/');
 const screens=await mountShell(page,memberships[1][1],'sales');
 expect(screens.map(x=>x.key)).toContain('sales');
 expect(screens.map(x=>x.key)).not.toContain('billing');
 await expect(page.locator('[data-ws-screen="sales"]')).toBeVisible();
 const status=await page.evaluate(()=>{
  const css=sel=>getComputedStyle(document.querySelector(sel));
  return {color:css('[data-ws-screen="sales"] .ws-screen-head h2').color,
   bg:css('[data-ws-screen="sales"] .ws-screen-head').backgroundColor,
   image:css('[data-ws-screen="sales"] .ws-screen-head').backgroundImage,
   sidebar:css('.os-desktop-sidebar').display};
 });
 expect(status.color).toBe('rgb(255, 255, 255)');
 expect(status.bg).toBe('rgba(0, 0, 0, 0)');
 expect(status.image).toBe('none');
 expect(status.sidebar).not.toBe('none');
 await page.screenshot({path:info.outputPath('midnight-sales-desktop.png'),animations:'disabled'});
});
test('Seven real role scopes retain navigation and mobile safe area',async({page},info)=>{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:900});
  await page.goto('/');
  for(const [name,role] of memberships){
   const screens=await mountShell(page,role);
   const result=await page.evaluate(()=>{
    const style=sel=>getComputedStyle(document.querySelector(sel));
    return {sidebar:style('.os-desktop-sidebar').display,dock:style('.os-mobile-bottom').display,
     slots:document.querySelectorAll('.os-mobile-bottom .os-mobile-tab').length,
     nav:document.querySelectorAll('.os-desktop-side-link').length,
     background:style('#app.workspace-mode').backgroundColor,
     width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
   });
   expect(result.background).toBe('rgb(4, 13, 63)');
   expect(result.slots).toBe(5);
   expect(result.nav).toBe(screens.length);
   expect(result.width,name+' '+width).toBeLessThanOrEqual(result.viewport+2);
   if(width===390){
    expect(result.sidebar).toBe('none');
    expect(result.dock).toBe('grid');
   }else{
    expect(result.sidebar).not.toBe('none');
    expect(result.dock).toBe('none');
   }
   if(['station-owner','corporate-admin','sales'].includes(name))
    await page.screenshot({path:info.outputPath('midnight-'+name+'-'+width+'.png'),animations:'disabled'});
  }
 }
});
