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
test('Reference guest login keeps angled green and cream styling at all breakpoints',async({page},info)=>{
 for(const width of [360,390,430,1280]){
  await page.setViewportSize({width,height:width===1280?800:844});
  await page.goto('/');
  await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
  await expect(page.locator('#google')).toBeVisible();
  await expect(page.locator('#facebook')).toBeVisible();
  const state=await page.evaluate(()=>{
   const style=sel=>getComputedStyle(document.querySelector(sel));
   return {hero:style('.os-auth-hero').backgroundImage,
    frame:style('.os-auth-frame').backgroundColor,card:style('.os-auth-card').backgroundColor,
    heading:style('.os-auth-hero h1').fontFamily,radius:style('.os-auth-provider').borderTopLeftRadius,
    width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
  });
  expect(state.hero).toContain('radial-gradient(');
  expect(state.frame).toBe('rgb(234, 231, 223)');
  expect(state.card).toBe('rgba(0, 0, 0, 0)');
  expect(state.heading).toContain('Noto Sans Thai');
  expect(state.radius).toBe('99px');
  expect(state.width).toBeLessThanOrEqual(state.viewport+2);
  await page.screenshot({path:info.outputPath('reference-login-'+width+'.png'),animations:'disabled'});
 }
});
test('Desktop is a real sidebar/topbar/dashboard grid, not a floating bottom dock',async({page},info)=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const screens=await mountShell(page,memberships[0][1]);
 await expect(page.locator('.os-desktop-sidebar')).toBeVisible();
 await expect(page.locator('#os-toolbar-credit')).toHaveCount(1);
 await expect(page.locator('.os-desktop-search')).toHaveCount(0);
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
   background:style('body').backgroundColor,
   card:style('.ws-quick').backgroundColor,
   grid:style('.ws-quick-grid').gridTemplateColumns.split(' ').length,
   dock:style('.os-mobile-bottom').display,
   width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth
  };
 });
 expect(state.columns).toBe(2);
 expect(state.sidebarWidth).toBeGreaterThan(200);
 expect(state.sidebarWidth).toBeLessThan(260);
 expect(state.sidebarBg).toBe('rgb(16, 39, 30)');
 expect(state.topBg).not.toBe('rgba(0, 0, 0, 0)');
 expect(state.background).toBe('rgb(234, 231, 223)');
 expect(state.card).toBe('rgb(247, 245, 239)');
 expect(state.grid).toBeGreaterThanOrEqual(2);
 expect(state.dock).toBe('none');
 expect(state.width).toBeLessThanOrEqual(state.viewport+2);
 await page.screenshot({path:info.outputPath('emerald-desktop-dashboard.png'),animations:'disabled',fullPage:true});
});
test('Sales desktop workspace keeps ivory surfaces and emerald authorized sidebar',async({page},info)=>{
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
 expect(status.color).toBe('rgb(255, 253, 248)');
 expect(status.bg).toBe('rgb(25, 70, 53)');
 expect(status.image).toContain('linear-gradient(');
 expect(status.sidebar).not.toBe('none');
 await page.screenshot({path:info.outputPath('emerald-sales-desktop.png'),animations:'disabled'});
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
     background:style('body').backgroundColor,
     width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
   });
   expect(result.background).toBe('rgb(234, 231, 223)');
   expect(result.slots).toBe(5);
   expect(result.nav).toBe(screens.length);
   expect(result.width,name+' '+width).toBeLessThanOrEqual(result.viewport+2);
   if(width===390){
    expect(result.sidebar).toBe('none');
    expect(result.dock).toBe('block');
    await expect(page.locator('.os-mobile-dock-inner')).toBeVisible();
   }else{
    expect(result.sidebar).not.toBe('none');
    expect(result.dock).toBe('none');
   }
   if(['station-owner','corporate-admin','sales'].includes(name))
    await page.screenshot({path:info.outputPath('emerald-'+name+'-'+width+'.png'),animations:'disabled'});
  }
 }
});

test('All 18 role-scoped workspaces render on ivory without page overflow at 320-1440px',async({page},info)=>{
 // Purely local style fixtures: never log in, write to Supabase or fabricate
 // financial statuses in Production. Their names match the actual role keys.
 const allMembers=[
  {scopeType:'platform',role:'platform_superadmin'},
  {scopeType:'platform',role:'platform_sales'},
  {scopeType:'platform',role:'platform_support'},
  {scopeType:'organization',role:'organization_owner',organizationId:'org'},
  {scopeType:'station',role:'station_owner',stationId:'station'},
  {scopeType:'station',role:'finance_manager',stationId:'station'},
  {scopeType:'station',role:'hr_manager',stationId:'station'},
  {scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'company'},
  {scopeType:'corporate_company',role:'driver',corporateCompanyId:'company'},
 ];
 const names=new Set(selectWorkspaceScreens(allMembers).map(x=>x.key));
 expect(names.size).toBe(18);
 const must=['overview','support','sales','activity','stations','plan','billing','fuel',
  'pump','customers','finance','hr','attendance','reviews','payroll','corporate',
  'driver','invitations'];
 expect([...names].sort()).toEqual([...must].sort());
 for(const width of [320,360,390,1024,1440]){
  await page.setViewportSize({width,height:width<850?840:900});
  await page.goto('/');
  const screens=await mountShell(page,allMembers);
  for(const item of screens){
   const state=await page.evaluate(key=>{
    const views=[...document.querySelectorAll('[data-ws-screen]')];
    for(const v of views)v.hidden=v.dataset.wsScreen!==key;
    const shell=document.querySelector('[data-workspace-shell]');
    shell.dataset.activeScreen=key;
    // Real selectors and form fields; this is anonymous *layout evidence*,
    // not an operational customer/transaction QA run.
    const target=document.querySelector('[data-ws-screen="'+key+'"] .ws-widget');
    if(target)target.innerHTML='<section class="module-item">'+
      '<h3>ตรวจรูปแบบหน้าจอ</h3><label class="field">ช่องกรอกข้อมูล'+
      '<input placeholder="ข้อมูลทดสอบรูปแบบหน้าจอ" value=""></label>'+
      '<button class="button primary" type="button">ยืนยันตัวอย่าง</button></section>';
    const style=selector=>getComputedStyle(document.querySelector(selector));
    const panel=target?.querySelector('.module-item');
    return {
      screen:key,background:style('body').backgroundColor,
      sidebar:style('.os-desktop-sidebar').backgroundColor,
      card:panel?getComputedStyle(panel).backgroundColor:null,
      ink:panel?getComputedStyle(panel).color:null,
      width:document.documentElement.scrollWidth,
      viewport:document.documentElement.clientWidth,
      hiddenViews:views.filter(v=>!v.hidden).length,
      dock:style('.os-mobile-bottom').display,
    };
   },item.key);
   expect(state.background,item.key+' '+width).toBe('rgb(234, 231, 223)');
   expect(state.sidebar,item.key+' '+width).toBe('rgb(16, 39, 30)');
   if(state.card)expect(state.card,item.key+' '+width).toBe('rgb(247, 245, 239)');
   if(state.ink)expect(state.ink,item.key+' '+width).toBe('rgb(27, 42, 36)');
   expect(state.hiddenViews).toBe(1);
   expect(state.width,item.key+' '+width).toBeLessThanOrEqual(state.viewport+2);
   expect(state.dock).toBe(width<851?'block':'none');
   if(['corporate','hr','invitations','driver'].includes(item.key)&&[390,1440].includes(width))
    await page.screenshot({path:info.outputPath('emerald-'+item.key+'-'+width+'.png'),animations:'disabled'});
  }
 }
});


test('Gold sweep decorates green navigation and headings without blocking controls',async({page},info)=>{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?900:844});
  await page.goto('/');
  await mountShell(page,memberships[5][1],'corporate');
  const details=await page.evaluate(()=>{
   const pseudo=(selector,part='::before')=>{
    const node=document.querySelector(selector);
    return node?getComputedStyle(node,part).backgroundImage:'missing';
   };
   const overlay=(selector)=>{
    const node=document.querySelector(selector);
    return node?getComputedStyle(node,'::before').pointerEvents:'missing';
   };
   return {
    sidebar:pseudo('.os-desktop-sidebar'),
    toolbar:pseudo('.ws-toolbar'),
    title:pseudo('.ws-screen:not([data-ws-screen="overview"]) .ws-screen-head'),
    dock:pseudo('.os-mobile-bottom'),
    toolbarClick:overlay('.ws-toolbar'),
    titleClick:overlay('.ws-screen:not([data-ws-screen="overview"]) .ws-screen-head'),
    width:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth
   };
  });
  expect(details.toolbar).toContain('radial-gradient(');
  expect(details.title).toContain('radial-gradient(');
  expect(details.toolbarClick).toBe('none');
  expect(details.titleClick).toBe('none');
  expect(details.width).toBeLessThanOrEqual(details.viewport+2);
  if(width===1440)expect(details.sidebar).toContain('radial-gradient(');
  else expect(details.dock).toContain('radial-gradient(');
  await page.screenshot({path:info.outputPath('gold-lined-corporate-'+width+'.png'),animations:'disabled'});
 }
});
