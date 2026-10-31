import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectFrequentScreens,incrementNavUsage,readNavUsage,saveNavUsage} from '../../src/client/nav-preferences.js';
import {renderMobileNav,renderMobileHome} from '../../src/client/mobile-home.js';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
import {renderWorkspaceCategories} from '../../src/client/workspace-categories.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const member=(scopeType,role,extra={})=>({scopeType,role,...extra});
const platform=selectWorkspaceScreens([member('platform','platform_superadmin')]);

test('first slot is Home; exactly five slots and four permitted frequent destinations',()=>{
 const html=renderMobileNav(platform,{billing:32,activity:24,sales:14,stations:9});
 const links=[...html.matchAll(/data-ws-go="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(links,['overview','billing','activity','sales','stations']);
 assert.equal((html.match(/class="os-mobile-tab /g)||[]).length,5);
 assert.doesNotMatch(html,/data-ws-scan|data-ws-more|data-ws-menu-toggle/);
 assert.match(html,/os-nav-orb/);
 assert.match(html,/os-nav-caption/);
});

test('frequent preference cannot grant new roles; missing roles preserve five visual slots',()=>{
 const cashier=selectWorkspaceScreens([member('station','cashier',{stationId:'station'})]);
 const keys=selectFrequentScreens(cashier,{finance:999,pump:2,attendance:1}).map(s=>s.key);
 assert.deepEqual(keys,['pump','attendance']);
 const nav=renderMobileNav(cashier,{finance:999,pump:2,attendance:1});
 assert.doesNotMatch(nav,/data-ws-go="finance"|data-ws-go="billing"/);
 assert.equal((nav.match(/class="os-mobile-tab /g)||[]).length,5);
 assert.equal((nav.match(/os-nav-orb-placeholder/g)||[]).length,2);
 const sales=renderMobileNav(selectWorkspaceScreens([member('platform','platform_sales')]),{finance:500});
 assert.doesNotMatch(sales,/data-ws-go="finance"|data-ws-go="pump"/);
});

test('counts rank frequent modules, cannot exceed max and never count Home',()=>{
 let counts={};
 counts=incrementNavUsage(counts,'sales');
 counts=incrementNavUsage(counts,'sales');
 counts=incrementNavUsage(counts,'activity');
 assert.deepEqual(selectFrequentScreens(platform,counts).map(s=>s.key),['sales','activity','stations','billing']);
 assert.deepEqual(incrementNavUsage(counts,'overview'),counts);
 const capped=incrementNavUsage({sales:10000,activity:1000},'sales');
 assert.ok(capped.sales<10000);
 assert.ok(capped.activity<=500);
});

test('usage remains per user and unavailable storage fails safely',()=>{
 const values=new Map();
 const store={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(saveNavUsage('alice',{sales:3},store),true);
 assert.equal(saveNavUsage('bob',{billing:4},store),true);
 assert.deepEqual(readNavUsage('alice',store),{sales:3});
 assert.deepEqual(readNavUsage('bob',store),{billing:4});
 assert.deepEqual(readNavUsage('alice',{getItem:()=>'{bad'}),{});
 assert.equal(saveNavUsage('alice',{}, {setItem:()=>{throw Error('quota');}}),false);
});

test('only Home has a complete menu; contextual one is under Header and exactly one shown',()=>{
 const shell=renderWorkspaceShell(platform);
 const home=renderMobileHome(platform);
 assert.doesNotMatch(home,/os-mobile-quick-grid/);
 assert.match(home,/os-mobile-feature-grid/);
 assert.match(shell,/ws-context-host/);
 assert.ok(shell.indexOf('ws-context-host')>shell.indexOf('<header class="ws-header">'));
 assert.ok(shell.indexOf('ws-context-host')<shell.indexOf('id="ws-content"'));
 assert.doesNotMatch(shell,/ws-sidebar|data-ws-menu-toggle|data-ws-rail-toggle|ws-nav-list/);
 const context=renderWorkspaceCategories(platform,'sales');
 assert.match(context,/os-context-orbs/);
 assert.match(context,/data-os-functional-menu/);
 assert.doesNotMatch(context,/data-ws-go=/);
 assert.doesNotMatch(context,/data-ws-go="billing"/);
 assert.equal(renderWorkspaceCategories(platform,'overview'),'');
});

test('mobile and desktop share glossy circular submenus and five-column dock',()=>{
 const css=read('public/oilstation.css');
 for(const part of ['radial-gradient','border-radius:50%','box-shadow','os-context-orbs',
  'grid-template-columns:repeat(5,minmax(0,1fr))','@media(max-width:850px)',
  'prefers-reduced-motion'])assert.ok(css.includes(part),part);
 const html=read('index.html');
 assert.match(html,/href="\/oilstation\.css"/);
 const source=read('src/client/workspace-layout.js');
 assert.match(source,/allowed\.has\(key\)/);
 assert.match(source,/root\.addEventListener\('click'/);
 assert.match(source,/readNavUsage\(userId\)/);
 assert.match(source,/saveNavUsage\(userId,counts\)/);
 assert.match(source,/key==='overview'\)bottom\(\)/);
});
