import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('one mobile bottom dock sits above content and the old drawer is disabled',()=>{
 const css=read('public/navigation-standard.css');
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/\.os-mobile-bottom/);
 assert.match(css,/z-index:70/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.ws-sidebar/);
 assert.match(css,/display:none!important/);
});

test('Home exposes allowed destinations and no sidebar or hamburger is rendered',()=>{
 const source=read('src/client/workspace-layout.js');
 const html=renderWorkspaceShell(selectWorkspaceScreens([
  {scopeType:'station',role:'station_owner',stationId:'station-a'},
 ]));
 assert.doesNotMatch(html,/data-ws-more|ws-sidebar|data-ws-menu-close|data-ws-menu-toggle/);
 assert.match(html,/data-ws-go="pump"/);
 assert.match(html,/data-ws-go="fuel"/);
 assert.match(html,/data-ws-go="overview"/);
 assert.match(source,/allowed\.has\(key\)/);
 assert.match(source,/root\.addEventListener\('click'/);
});

test('fix is last stylesheet and does not change desktop Gentelella design',()=>{
 const html=read('index.html');
 const gentelella=html.indexOf('/gentelella-v4-selected.css');
 const mobile=html.indexOf('/mobile-app.css');
 assert.ok(gentelella>0&&mobile>gentelella);
 assert.match(read('public/gentelella-v4-selected.css'),/--gt-sidebar:#1a2332/);
 assert.match(read('public/mobile-app.css'),/@media\(max-width:850px\)/);
});
