import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('open mobile sidebar is above overlay and bottom tabs, so taps reach the menu',()=>{
 const css=read('public/mobile-app.css');
 const patch=css.slice(css.lastIndexOf('/* Mobile drawer must sit ABOVE'));
 assert.ok(patch.includes('@media(max-width:850px)'), 'fix must only apply on small screens');
 const drawer=patch.match(/\.ws-sidebar\{[\s\S]*?z-index:(\d+)/);
 const backdrop=patch.match(/\.ws-menu-backdrop:not\(\[hidden\]\)\{[\s\S]*?z-index:(\d+)/);
 const tabs=patch.match(/\.os-mobile-bottom\{[\s\S]*?z-index:(\d+)/);
 assert.ok(drawer&&backdrop&&tabs,'drawer/backdrop/bottom tabs each need explicit stacking');
 assert.ok(Number(drawer[1])>Number(backdrop[1]),'drawer MUST be above backdrop');
 assert.ok(Number(backdrop[1])>Number(tabs[1]),'backdrop MUST cover bottom navigation when drawer opens');
 assert.match(patch,/pointer-events:auto/);
 assert.match(patch,/\.ws-layout\[data-rail="collapsed"\] \.ws-sidebar/);
});

test('mobile drawer opens accessibly, passes taps to an authorized menu and closes',()=>{
 const source=read('src/client/workspace-layout.js');
 const html=renderWorkspaceShell(selectWorkspaceScreens([
  {scopeType:'station',role:'station_owner',stationId:'station-a'},
 ]));
 assert.match(html,/data-ws-more/);
 assert.match(html,/data-ws-menu-close/);
 assert.match(html,/data-ws-go="pump"/);
 assert.match(html,/data-ws-go="fuel"/);
 assert.match(html,/data-ws-go="overview"/);
 assert.match(source,/mobileMore\?\.addEventListener\("click"/);
 assert.match(source,/menu\?\.classList\.toggle\("is-open",active\)/);
 assert.match(source,/menu\.inert=Boolean\(mobile\?\.matches&&!active\)/);
 assert.match(source,/if\(backdrop\)backdrop\.hidden=!active/);
 assert.match(source,/button\.addEventListener\("click"/);
 assert.match(source,/closeMenu\(\)/);
});

test('fix is last stylesheet and does not change desktop Gentelella design',()=>{
 const html=read('index.html');
 const gentelella=html.indexOf('/gentelella-v4-selected.css');
 const mobile=html.indexOf('/mobile-app.css');
 assert.ok(gentelella>0&&mobile>gentelella);
 assert.match(read('public/gentelella-v4-selected.css'),/--gt-sidebar:#1a2332/);
 assert.match(read('public/mobile-app.css'),/@media\(max-width:850px\)/);
});
