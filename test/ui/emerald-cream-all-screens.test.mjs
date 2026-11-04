import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {authMarkup} from '../../src/client/auth-screen.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const css=read('public/oilstation.css');
const html=read('index.html');

test('all OilStation screens share exact approved login forest, cream and gold tokens',()=>{
 for(const token of [
   '--os-bg:#EAE7DF','--os-side:#10271E',
   '--os-card:#F7F5EF','--os-tx:#1B2A24',
   '--os-ac:#194635','--os-gold:#BD9A5E',
   '--os-input:#FFFDF8','--os-side-tx:#F7F5EF',
   '--auth-forest:#10271e','--auth-cream:#eae7df','--auth-gold:#bd9a5e',
   '--mid-card:var(--os-card)','--gt-surface:var(--os-card)',
   '--oil-canvas:var(--os-bg)'
 ])assert.ok(css.includes(token),token);
 assert.doesNotMatch(css,/#060F33|#040B28|#0E1B47|#2BB6C9|#0D8091/i);
 assert.match(html,/name="color-scheme" content="light"/);
 assert.match(html,/name="theme-color" content="#10271E"/);
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1);
 assert.match(html,/href="\/oilstation\.css"/);
});

test('green navigation, ivory content and form inputs stay separate by surface',()=>{
 for(const s of [
  '.os-desktop-sidebar','.os-desktop-side-link',
  '.os-desktop-side-footer','.ws-toolbar',
  '.os-toolbar-logout','.os-toolbar-credit',
  '.os-functional-nav','.os-category-tab',
  '.ws-screen-head','.ws-quick','.balance-card',
  '.coupon-form','.invite-form','.os-logout-dialog',
  '.os-mobile-bottom','.os-mobile-tab',
  '.os-mobile-feature','.os-mobile-search'
 ]) assert.ok(css.includes(s),s);
 assert.match(css,/\.os-desktop-sidebar\{[^}]*background:var\(--os-side\)/);
 assert.match(css,/\.os-desktop-sidebar\{[^}]*background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/\.ws-layout\{[^}]*background-image:var\(--os-gradient-page\)/);
 assert.match(css,/\.ws-screen:not\(\[data-ws-screen="overview"\]\)>\.ws-screen-head\{/);
 assert.match(css,/\.ws-toolbar\{[\s\S]*?background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/\.os-desktop-side-link\.is-current[^}]*background:var\(--os-bg\)/);
 assert.match(css,/\.os-mobile-bottom\{position:fixed;[\s\S]*?background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/\.os-mobile-tab\.is-current[^}]*color:var\(--os-side-tx\)/);
 assert.match(css,/\.os-category-tab\.active[^}]*background-image:var\(--os-gradient-menu\)/);
 assert.match(css,/#app :is\(input:not\([^)]+\),select,textarea\)\{background:var\(--os-input\)/);
 assert.match(css,/\.os-logout-dialog\{[^}]*background:var\(--os-card\)/);
});


test('gold curves are shared only by green navigation and page header surfaces',()=>{
 for(const name of ['--os-gold-line:','--os-gold-line-soft:'])
  assert.ok(css.includes(name),'shared gold token '+name);
 for(const selector of [
  '.os-desktop-sidebar::before',
  '.ws-toolbar::before',
  '.ws-toolbar::after',
  '.ws-screen:not([data-ws-screen="overview"])>.ws-screen-head::before',
  '.ws-screen:not([data-ws-screen="overview"])>.ws-screen-head::after',
  '.os-mobile-bottom::before',
 ])assert.ok(css.includes(selector),'missing decorative motif '+selector);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/\.ws-toolbar > \*\{position:relative;z-index:1\}/);
 assert.match(css,/\.os-desktop-sidebar > \*\{position:relative;z-index:1\}/);
 assert.doesNotMatch(css,/\.ws-toolbar\{[^}]*overflow:hidden/);
 assert.match(css,/\.os-mobile-dock-inner\{[^}]*z-index:1/);
});

test('role navigation still covers all 18 main screens without privilege crossover',()=>{
 const roles=[
  {scopeType:'platform',role:'platform_superadmin'},
  {scopeType:'platform',role:'platform_sales'},
  {scopeType:'platform',role:'platform_support'},
  {scopeType:'organization',role:'organization_owner',organizationId:'org'},
  {scopeType:'station',role:'station_owner',stationId:'station'},
  {scopeType:'station',role:'hr_manager',stationId:'station'},
  {scopeType:'station',role:'cashier',stationId:'station'},
  {scopeType:'station',role:'finance_manager',stationId:'station'},
  {scopeType:'corporate_company',role:'corporate_admin',corporateCompanyId:'company'},
  {scopeType:'corporate_company',role:'driver',corporateCompanyId:'company'},
 ];
 const keys=new Set(roles.flatMap(r=>selectWorkspaceScreens([r]).map(s=>s.key)));
 const expected=['overview','support','sales','activity','stations','plan','billing','fuel','pump',
  'customers','finance','hr','attendance','reviews','payroll','corporate','driver','invitations'];
 assert.deepEqual([...keys].sort(),[...expected].sort());
 const cashier=renderWorkspaceShell(selectWorkspaceScreens([{scopeType:'station',role:'cashier',stationId:'s'}]));
 assert.doesNotMatch(cashier,/data-ws-go="billing"|data-ws-go="finance"/);
 assert.match(cashier,/os-desktop-sidebar/);
 assert.match(cashier,/os-mobile-bottom/);
 assert.doesNotMatch(cashier,/data-ws-go="corporate"/);
});

test('auth, invitation and QA remain wired to original secure sign-in surfaces',()=>{
 for(const props of [{},{invited:true},{setup:true},{qaMode:true}]){
  const ui=authMarkup(props);
  assert.match(ui,/os-auth-shell/);
  assert.match(ui,/os-auth-card/);
  assert.match(ui,/data-brand-icon="google"/);
  assert.match(ui,/data-brand-icon="facebook"/);
 }
 assert.match(authMarkup({qaMode:true}),/minlength="8"/);
 assert.doesNotMatch(authMarkup(),/id="qa-login-form"/);
 assert.match(css,/\.os-auth-frame\{/);
 assert.match(css,/clip-path:polygon\(0 0,73% 0,100% 100%,0 100%\)/);
});
