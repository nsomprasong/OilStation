import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const platform={scopeType:'platform',role:'platform_superadmin'};
test('legacy components retain behavior under the sole LuxCart stylesheet',()=>{
 const html=read('index.html'),css=read('public/oilstation.css');
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1);
 assert.match(html,/href="\/oilstation\.css"/);
 for(const token of ['#040D3F','#141C4E','#1D2552','252px','68px'])
  assert.ok(css.includes(token),token);
 assert.match(css,/\.ws-nav\.active/);
 assert.match(css,/\.ws-sidebar/);
 assert.match(css,/\.ws-toolbar/);
 assert.match(css,/\.saas-simple-card/);
 assert.match(css,/\.fuel-row/);
 assert.match(css,/\.owner-plan-card/);
 assert.match(css,/\.attendance-workspace|\.ws-widget>section/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/\.ws-layout\[data-rail="collapsed"\] \.ws-sidebar\.is-open/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Home and a single Header submenu replace legacy drawer on all screen sizes',()=>{
 const html=renderWorkspaceShell(selectWorkspaceScreens([platform]));
 const source=read('src/client/workspace-layout.js');
 assert.doesNotMatch(html,/data-ws-rail-toggle|data-ws-menu-toggle|data-ws-menu-close|ws-sidebar/);
 assert.doesNotMatch(source,/oilstation_sidebar_rail|openMenu\(/);
 assert.match(html,/ws-context-host/);
 assert.match(html,/data-context-for="sales"/);
 assert.match(html,/data-ws-go="stations"/);
 assert.doesNotMatch(html,/data-ws-go="fuel"/);
});

test('theme selection preserves Thai workflow and does not add demo or finance endpoints',()=>{
 const design=read('DESIGN.md'),agents=read('AGENTS.md');
 assert.match(design,/Gentelella v4/);
 assert.match(agents,/LuxCart/);
 assert.match(design,/No fake payment success/);
 assert.match(read('src/client/main.js'),/เชิญเจ้าของปั๊ม/);
 const css=read('public/oilstation.css');
 assert.doesNotMatch(css,/https?:\/\/(?:cdn|unpkg|fonts)\./);
 assert.doesNotMatch(read('package.json'),/gentelella/);
});
test('Home and contextual orb icons use the pinned Lucide allowlist, not hamburger buttons',()=>{
 const icons=read('src/client/icons.js');
 assert.match(icons,/home:House/);
 assert.match(icons,/users:UsersRound/);
 const shell=renderWorkspaceShell(selectWorkspaceScreens([platform]));
 assert.match(shell,/data-ui-icon="home"/);
 assert.match(shell,/os-nav-orb/);
 assert.doesNotMatch(shell,/data-ui-icon="menu"|id="logout"/);
 assert.equal((shell.match(/class="os-toolbar-logout"/g)||[]).length,1);
});
