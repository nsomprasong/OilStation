import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const css=read('public/oilstation.css');
const html=read('index.html');
test('OilStation references only the canonical Midnight app stylesheet',()=>{
 assert.match(html,/href="\/oilstation\.css"/);
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1);
 assert.doesNotMatch(html,/href="\/(luxcart|mobile-app|gentelella-v4-selected)\.css"/);
 assert.match(html,/name="color-scheme" content="dark"/);
});
test('Midnight page, surfaces, font and status tokens follow supplied reference',()=>{
 for(const color of ['#040D3F','#141C4E','#1D2552','#243066','#B9BBC7','#7FE089','#F97D7D','#0D8091'])
  assert.ok(css.includes(color),color);
 for(const font of ['Inter','Noto Sans Thai','JetBrains Mono'])
  assert.ok(css.includes(font),font);
 for(const tok of ['--mid-page:','--mid-card:','--mid-cyan:'])
  assert.ok(css.includes(tok),tok);
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
 assert.match(css,/grid-template-columns:224px minmax\(0,1fr\)/);
 assert.match(css,/\.os-desktop-sidebar/);
 assert.match(css,/\.os-midnight-layout \[data-ws-screen="overview"\] \.ws-quick-grid/);
});
test('Mobile only has five-slot dock, desktop dock stays hidden, no teal banner',()=>{
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/\.os-midnight-layout \.os-mobile-bottom\{display:none!important\}/);
 assert.match(css,/\.os-midnight-layout \.os-mobile-bottom\{[\s\S]*?display:grid!important/);
 assert.match(css,/\.os-midnight-layout \.ws-screen-head\{/);
 assert.doesNotMatch(css,/background:linear-gradient\(115deg,#077a6f,#12a58b\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/:focus-visible/);
});
