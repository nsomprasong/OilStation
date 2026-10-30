import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractGoldLogoPng} from '../../scripts/materialize-brand-assets.mjs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
import {authMarkup} from '../../src/client/auth-screen.js';
import {renderMobileHome} from '../../src/client/mobile-home.js';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('user-selected gold logo is a valid real transparent PNG, not placeholder O artwork',()=>{
 const svg=read('public/oilstation-gold-logo.svg');
 assert.match(svg,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
 assert.match(svg,/data:image\/png;base64,/);
 assert.doesNotMatch(svg,/<text\b/i);
 const png=extractGoldLogoPng(svg);
 assert.equal(png.readUInt32BE(16),128);
 assert.equal(png.readUInt32BE(20),128);
 assert.ok(png.length>4000);
});
test('favicon, touch icon and title use the gold symbol consistently',()=>{
 const html=read('index.html');
 assert.match(html,/<title>OilStation \| ระบบบริหารปั๊มน้ำมัน<\/title>/);
 assert.match(html,/rel="icon" type="image\/png"[^>]*oilstation-gold-logo\.png/);
 assert.doesNotMatch(html,/rel="icon" type="image\/svg\+xml"/);
 assert.match(html,/rel="apple-touch-icon"[^>]*oilstation-gold-logo\.png/);
 assert.match(html,/class="brand-icon" src="\/oilstation-gold-logo\.png"/);
});
test('same gold brand asset replaces letter O in mobile, desktop sidebar and login',()=>{
 const auth=authMarkup(),mobile=renderMobileHome(selectWorkspaceScreens([
  {scopeType:'station',role:'station_owner',stationId:'demo'}
 ]));
 const shell=renderWorkspaceShell(selectWorkspaceScreens([
  {scopeType:'station',role:'station_owner',stationId:'demo'}
 ]));
 assert.match(auth,/class="os-auth-mark" src="\/oilstation-gold-logo\.png"/);
 assert.match(mobile,/class="os-mobile-brandmark" src="\/oilstation-gold-logo\.png"/);
 assert.match(shell,/class="ws-logo" src="\/oilstation-gold-logo\.png"/);
 assert.match(shell,/class="ws-toolbar-brand" src="\/oilstation-gold-logo\.png"/);
 assert.doesNotMatch(auth,/class="os-auth-mark">O<\/span>/);
 assert.doesNotMatch(shell,/class="ws-logo"[^>]*>O<\/span>/);
 assert.match(mobile,/data-mobile-logout/);
});
test('brand icons materialize at build/dev and CSS keeps the transparent background',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts.prebuild,/materialize-brand-assets\.mjs/);
 assert.match(pkg.scripts.predev,/materialize-brand-assets\.mjs/);
 const css=read('public/oilstation-brand.css');
 assert.match(css,/background:transparent!important/);
 assert.match(css,/\.ws-logo/);
 assert.match(css,/\.os-auth-mark/);
 assert.match(css,/\.os-mobile-brandmark/);
 const html=read('index.html');
 assert.ok(html.indexOf('oilstation-brand.css')>html.indexOf('oilstation-unified.css'));
});
