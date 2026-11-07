import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
import {renderMobileNav} from '../../src/client/mobile-home.js';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const helper=read('src/client/moving-active-highlight.js');
const css=read('public/oilstation.css');
const shell=read('src/client/workspace-layout.js');
const functional=read('src/client/functional-submenus.js');

test('ANM-NAV-001 animates a single persistent marker between selected items',()=>{
 assert.match(helper,/rail\.prepend\(indicator\)/);
 assert.match(helper,/indicator\.style\.transform='translate3d\('/);
 assert.match(helper,/indicator\.style\.width=g\.w/);
 assert.match(helper,/indicator\.style\.height=g\.h/);
 assert.match(helper,/getBoundingClientRect\(\)/);
 assert.match(helper,/ResizeObserver/);
 assert.match(helper,/prefers-reduced-motion: reduce/);
 assert.match(css,/ANM-NAV-001/);
 assert.match(css,/transform 520ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/width 520ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/height 520ms cubic-bezier\(\.22,1,\.36,1\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('both sidebar and mobile dock keep one selected location and role filtered destinations',()=>{
 assert.match(shell,/installMovingActiveHighlight\(root\.querySelector\('\.os-desktop-side-nav'\)/);
 assert.match(shell,/mobileHighlight=installMovingActiveHighlight/);
 assert.match(shell,/if\(mobileHighlight&&before\.join\('\|'\)===after\.join\('\|'\)\)return/);
 assert.match(shell,/desktopHighlight\?\.select\(key,\{snap:!track\}\)/);
 assert.match(shell,/mobileHighlight\?\.select\(key,\{snap:!track\}\)/);
 assert.match(shell,/if\(!allowed\.has\(key\)\)return false/);
 const screens=selectWorkspaceScreens([{scopeType:'station',role:'cashier',stationId:'qa'}]);
 const markup=renderWorkspaceShell(screens);
 assert.equal((markup.match(/class="os-desktop-side-link/g)||[]).length,screens.length);
 assert.doesNotMatch(renderMobileNav(screens),/data-ws-go="finance"/);
});
test('functional tabs morph across real authorized task buttons without changing pane selection',()=>{
 assert.match(functional,/state\.marker=noMenu\?null:installMovingActiveHighlight/);
 assert.match(functional,/selector:'button\[data-os-pane-key\]'/);
 assert.match(functional,/state\.marker\?\.select\(id\)/);
 assert.match(functional,/state\.marker\?\.dispose\(\)/);
 assert.match(functional,/state\.panes\.filter\(p=>isAvailable\(state,p\)\)/);
});
test('keyboard arrows, Home/End, focus and native click retain existing business routing',()=>{
 for(const key of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'])
  assert.ok(helper.includes(key),key);
 assert.match(helper,/items\[dest\]\.focus\(\{preventScroll:true\}\)/);
 assert.match(helper,/items\[dest\]\.click\(\)/);
 assert.doesNotMatch(helper,/document\.addEventListener\(['"]click/);
 assert.match(css,/\.os-category-tab:focus-visible/);
 assert.match(css,/\.os-desktop-side-link:focus-visible/);
});
