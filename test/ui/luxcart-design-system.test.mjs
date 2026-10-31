import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const css=read('public/luxcart.css');
const html=read('index.html');

test('LuxCart is the final stylesheet after navigation, functional menus and QA',()=>{
  assert.match(html,/href="\/luxcart\.css"/);
  const lux=html.indexOf('href="/luxcart.css"');
  for(const name of ['navigation-standard.css','functional-submenus.css','qa-mode.css','gentelella-v4-selected.css'])
    assert.ok(lux>html.indexOf('href="/'+name+'"'),name);
});
test('canonical LuxCart tokens, typo stack and semantic colors are defined',()=>{
  for(const hex of ['#1C1917','#FFFBEB','#FFFFFF','#B8860B','#D4D4D8','#166534','#CA8A04','#991B1B','#1E40AF'])
    assert.ok(css.includes(hex),hex);
  for(const family of ['Cormorant Garamond','Raleway','JetBrains Mono','Noto Sans Thai','Noto Serif Thai'])
    assert.ok(css.includes(family),family);
  assert.match(css,/--lux-primary:/);
  assert.match(css,/--lux-shadow:/);
});
test('both app modes and old navigation visuals are restyled without JS workflow edits',()=>{
  for(const sel of ['#app.workspace-mode','.os-functional-nav','.os-mobile-bottom','.os-mobile-feature','.ws-quick','.os-mobile-page-hero','#app.auth-mode','.os-auth-hero','.os-auth-provider','.os-nav-orb','.button.primary'])
    assert.ok(css.includes(sel),sel);
  assert.match(css,/@media\(max-width:850px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\[hidden\]/);
});

test('legacy teal desktop banner removed, LuxCart sets every key Sales surface',()=>{
 const legacy=read('public/oilstation-unified.css');
 assert.doesNotMatch(legacy,/background:linear-gradient\(115deg,#077a6f,#12a58b\)/);
 assert.doesNotMatch(legacy,/#app\.workspace-mode \.ws-main\{background:#f4f8f7\}/);
 assert.match(css,/#app\.workspace-mode \.ws-screen-head\{[^}]*background:transparent!important/s);
 assert.match(css,/#app\.workspace-mode \.ws-main\{[^}]*background:var\(--lux-cream\)!important/s);
 assert.match(css,/@media\(min-width:851px\)\{[^}]*\.os-mobile-bottom/s);
});
