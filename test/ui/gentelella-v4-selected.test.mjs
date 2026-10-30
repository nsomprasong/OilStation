import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const platform={scopeType:'platform',role:'platform_superadmin'};
test('selected Gentelella v4 loads as the final canonical CSS layer',()=>{
 const html=read('index.html'),css=read('public/gentelella-v4-selected.css');
 const positions=['styles.css','workspace-gentelella.css','impeccable.css','gentelella-v4-selected.css'].map(x=>html.indexOf('href="/'+x+'"'));
 assert.ok(positions.every(x=>x>0));
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 for(const token of ['#1a2332','#1abb9c','#169f85','#f5f7fb','#e6e7eb','252px','68px'])
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
test('desktop rail is keyboard-usable and mobile drawer retains accessibility',()=>{
 const html=renderWorkspaceShell(selectWorkspaceScreens([platform]));
 const source=read('src/client/workspace-layout.js');
 assert.match(html,/data-ws-rail-toggle/);
 assert.match(html,/aria-label="ย่อเมนูด้านข้าง"/);
 assert.match(html,/aria-pressed="false"/);
 assert.match(html,/data-ws-menu-toggle/);
 assert.match(source,/oilstation_sidebar_rail/);
 assert.match(source,/sessionStorage\.setItem\('oilstation_sidebar_rail',rail\)/);
 assert.match(source,/menu\.inert=Boolean\(mobile\?\.matches&&!active\)/);
 assert.match(source,/event\.key==="Escape"/);
 assert.match(source,/event\.key==="Tab"/);
 assert.match(html,/data-ws-go="stations"/);
 assert.doesNotMatch(html,/data-ws-go="fuel"/);
});
test('theme selection preserves Thai workflow and does not add demo or finance endpoints',()=>{
 const design=read('DESIGN.md'),agents=read('AGENTS.md');
 assert.match(design,/Gentelella v4/);
 assert.match(agents,/Gentelella v4/);
 assert.match(design,/No fake payment success/);
 assert.match(read('src/client/main.js'),/เชิญเจ้าของปั๊ม/);
 const css=read('public/gentelella-v4-selected.css');
 assert.doesNotMatch(css,/https?:\/\/(?:cdn|unpkg|fonts)\./);
 assert.doesNotMatch(read('package.json'),/gentelella/);
});
test('new menu icon belongs to pinned Lucide allowlist, no duplicate logos',()=>{
 const icons=read('src/client/icons.js');
 assert.match(icons,/\bMenu\b/);
 assert.match(icons,/menu:Menu/);
 const shell=renderWorkspaceShell(selectWorkspaceScreens([platform]));
 assert.match(shell,/data-ui-icon="menu"/);
 assert.equal((shell.match(/id="logout"/g)||[]).length,1);
});
