import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderMobileScreenHero,renderMobileHome} from '../../src/client/mobile-home.js';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
import {renderWorkspaceCategories} from '../../src/client/workspace-categories.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const station={scopeType:'station',role:'station_owner',stationId:'s'};
test('every authorized screen shares one Header submenu outside its content',()=>{
 const screens=selectWorkspaceScreens([station]);
 const html=renderWorkspaceShell(screens);
 assert.match(html,/ws-context-host/);
 for(const screen of screens.filter(s=>s.key!=='overview')){
  assert.match(html,new RegExp('data-context-for="'+screen.key+'"'));
  const pos=html.indexOf('id="ws-'+screen.key+'"');
  const fragment=html.slice(pos,html.indexOf('</section>',pos));
  assert.match(fragment,/os-mobile-page-content/,screen.key);
  assert.match(fragment,/ws-widget/,screen.key);
  assert.doesNotMatch(fragment,/os-mobile-page-shortcuts|os-category-nav|os-mobile-page-hero/,screen.key);
 }
 assert.doesNotMatch(html,/ws-sidebar|data-ws-menu-toggle/);
});

test('under-header submenu shows only role-allowed related icons and labels',()=>{
 const screens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_superadmin'}]);
 const shell=renderWorkspaceShell(screens);
 assert.match(renderWorkspaceCategories(screens,'stations'),/data-os-functional-menu/);
 assert.match(shell,/data-context-for="stations"/);
 assert.match(shell,/os-context-orbs/);
 assert.doesNotMatch(shell,/data-ws-go="pump"|data-ws-go="fuel"/);
 assert.doesNotMatch(renderWorkspaceCategories(screens,'stations'),/data-ws-go=/);
});

test('home has an accessible power icon in the top-right corner which uses existing sign-out action',()=>{
 const screens=selectWorkspaceScreens([station]);
 const home=renderMobileHome(screens);
 const layout=read('src/client/workspace-layout.js');
 const main=read('src/client/main.js');
 assert.match(home,/data-mobile-logout/);
 assert.match(home,/aria-label="ออกจากระบบ"/);
 assert.match(home,/data-ui-icon="power"/);
 assert.match(read('src/client/logout-dialog.js'),/data-mobile-logout/);
 assert.doesNotMatch(layout,/window\.confirm\(/);
 assert.match(layout,/wireLogoutDialog\(root\)/);
 assert.match(layout,/renderLogoutDialog\(\)/);
 assert.match(read('src/client/logout-dialog.js'),/oilstation:logoutrequested/);
 assert.match(main,/addEventListener\('oilstation:logoutrequested',signOut\)/);
 assert.match(main,/authClient\.auth\.signOut\(\)/);
 assert.match(read('src/client/icons.js'),/power:Power/);
});
test('teal full-bleed mobile hero and coherent cards render on every subpage while desktop remains Gentelella',()=>{
 const css=read('public/mobile-app.css');
 assert.match(css,/\.os-mobile-page-hero/);
 assert.match(css,/\.os-mobile-page-content/);
 assert.match(css,/\.os-mobile-page-shortcuts/);
 assert.match(css,/\.os-mobile-power/);
 assert.match(css,/\.ws-layout\[data-active-screen="overview"\]/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(read('public/gentelella-v4-selected.css'),/--gt-sidebar:#1a2332/);
});
