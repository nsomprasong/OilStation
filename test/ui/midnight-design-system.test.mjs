import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const css=read('public/oilstation.css');
const html=read('index.html');
test('OilStation references only the canonical forest and cream app stylesheet',()=>{
 assert.match(html,/href="\/oilstation\.css"/);
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1);
 assert.doesNotMatch(html,/href="\/(luxcart|mobile-app|gentelella-v4-selected)\.css"/);
 assert.match(html,/name="color-scheme" content="light"/);
});
test('Committed CSS v3 login green and cream, fonts and compatibility aliases are canonical',()=>{
 for(const tok of [
  '--os-bg:#EAE7DF','--os-side:#10271E','--os-card:#F7F5EF',
  '--os-ac:#194635','--os-ac-deep:#174735',
  '--mid-page:var(--os-bg)','--mid-card:var(--os-card)',
  '--mid-cyan:var(--os-ac-deep)'
 ]) assert.ok(css.includes(tok),tok);
 for(const font of ['Inter','Noto Sans Thai','JetBrains Mono'])
  assert.ok(css.includes(font),font);
});
test('Desktop layout includes actual role-filtered sidebar, search and grid',()=>{
 const screens=selectWorkspaceScreens([{scopeType:'platform',role:'platform_sales'}]);
 const shell=renderWorkspaceShell(screens);
 assert.match(shell,/os-desktop-sidebar/);
 assert.match(shell,/os-desktop-side-nav/);
 assert.match(shell,/data-desktop-search/);
 assert.match(shell,/os-midnight-layout/);
 assert.equal((shell.match(/class="os-desktop-side-link/g)||[]).length,screens.length);
 assert.doesNotMatch(shell,/data-ws-go="billing"/);
 assert.match(css,/--os-side-w:248px/);
 assert.match(css,/grid-template-columns:var\(--os-side-w\) minmax\(0,1fr\)/);
 assert.match(css,/\.os-desktop-sidebar/);
 assert.match(css,/\.ws-quick-grid\{display:grid/);
 assert.match(css,/grid-template-columns:repeat\(auto-fill,minmax\(230px,1fr\)\)/);
});
test('Mobile only has five-slot dock, desktop dock stays hidden, no teal banner',()=>{
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/\.os-mobile-bottom\{display:none\}/);
 assert.match(css,/\.os-mobile-bottom\{position:fixed;[\s\S]*?display:grid/);
 assert.match(css,/\.ws-screen-head\{/);
 assert.match(css,/\.ws-layout\{display:block\}/);
 assert.doesNotMatch(css,/background:linear-gradient\(115deg,#077a6f,#12a58b\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});
