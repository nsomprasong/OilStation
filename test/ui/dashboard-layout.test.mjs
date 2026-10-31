import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectWorkspaceScreens,renderWorkspaceShell} from '../../src/client/workspace-layout.js';
const member=(scopeType,role,extra={})=>({scopeType,role,...extra});
const keys=m=>selectWorkspaceScreens(m).map(x=>x.key);
test('platform superadmin has wide workspace and separate SaaS navigation',()=>{
 const screens=selectWorkspaceScreens([member('platform','platform_superadmin')]);
 assert.deepEqual(keys([member('platform','platform_superadmin')]),['overview','sales','activity','stations','billing']);
 const html=renderWorkspaceShell(screens);
 assert.match(html,/data-workspace-shell/);assert.match(html,/id="platform-workspace"/);
 assert.match(html,/id="platform-saas-billing"/);assert.match(html,/data-ws-go="stations"/);
 assert.equal((html.match(/class="os-toolbar-logout"/g)||[]).length,1);
});
test('scoped workers see only their available modules',()=>{
 assert.deepEqual(keys([member('station','cashier',{stationId:'s'})]),['overview','pump','attendance']);
 assert.deepEqual(keys([member('corporate_company','corporate_admin',{corporateCompanyId:'c'})]),['overview','corporate','invitations']);
});
test('multi-scope screen mount ids stay unique',()=>{
 const screens=selectWorkspaceScreens([member('platform','platform_superadmin'),member('organization','owner',{organizationId:'o'}),member('station','station_owner',{stationId:'s'}),member('corporate_company','corporate_admin',{corporateCompanyId:'c'})]);
 const ids=[...renderWorkspaceShell(screens).matchAll(/ id="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size);
});
test('desktop width overrides narrow login without breaking sign-in and mobile',()=>{
 const css=readFileSync(new URL('../../public/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.center\{width:min\(100%,540px\)/);
 assert.match(css,/#app\.center\.workspace-mode\{width:min\(100%,1600px\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.ws-screen\[hidden\]\{display:none!important\}/);
 const source=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
 assert.match(source,/show\(renderWorkspaceShell\(screens\)\)/);
 assert.match(source,/wireWorkspaceNavigation\(root,\{screens,userId:session\.user\?\.id\}\)/);
});
