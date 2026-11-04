import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountMemberInvitations} from '../../src/client/member-invitations.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');

test('member management is list-first and has one real primary action plus drawer',()=>{
 assert.equal(typeof mountMemberInvitations,'function');
 const source=read('src/client/member-invitations.js');
 for(const part of [
  "el('div','os-member-page')",
  "el('section','os-member-list')",
  "button('button primary os-member-create','เพิ่มสมาชิก'",
  "el('dialog','os-member-drawer')",
  'dialog.showModal()','dialog.close()',
  "el('div','os-member-kind-tabs')",
  "addTab('invite','เชิญด้วยอีเมล'",
  "addTab('qa','บัญชีทดสอบ QA'",
  "if(readOnlyMessage)",
  "if(canManage)",
  "aria-selected",
  'ArrowLeft','ArrowRight','Home','End',
 ])assert.ok(source.includes(part),part);
 assert.match(source,/ที่สร้างสำเร็จในหน้านี้เท่านั้น ไม่ใช่รายชื่อสมาชิกทั้งหมดของบริษัท/);
 assert.doesNotMatch(source,/fetch\(/,'Never fabricate or expose directory queries in UI');
});
test('server-backed invite and QA Auth handling remain permission-checked and unchanged',()=>{
 const source=read('src/client/main.js');
 const qa=read('src/client/qa-accounts.js');
 assert.match(source,/mountMemberInvitations\(\{target:host,inviteControl,qaHost\}\)/);
 assert.match(source,/getApi\('\/api\/invitations\/create',accessToken/);
 assert.match(source,/kind:'invitation',name:email\.value\.trim\(\)/);
 assert.match(qa,/fetch\('\/api\/qa\/accounts'/);
 assert.match(qa,/fetch\('\/api\/qa\/reset-password'/);
 assert.match(qa,/role:\(roles\[scopeType\.value\]/);
 assert.match(qa,/kind:'qa',name:data\.account\.alias/);
 assert.match(source,/mountQaAccountsAdmin\(\{target:qaHost,token:session\.access_token,mode:'corporate_admin'\}\)/);
 assert.match(source,/mountQaAccountsAdmin\(\{target:qaHost,token:session\.access_token,mode:'station_owner'\}\)/);
 assert.match(source,/readOnlyMessage:'Sales เปิดปั๊ม/);
});
test('no duplicate floating invite or fake single tab; nested card stays only inside modal',()=>{
 const progressive=read('src/client/progressive-workspace.js');
 const submenus=read('src/client/functional-submenus.js');
 const css=read('public/oilstation.css');
 assert.match(progressive,/if\(screen\.querySelector\('#member-invites \.os-member-page'\)\)return/);
 assert.match(submenus,/singleInvitation=state\.key==='invitations'&&available\.length===1/);
 assert.match(submenus,/const signature=singleInvitation\?'':/);
 for(const part of [
  '.os-member-create','.os-member-list','.os-member-drawer',
  '.os-member-kind-panel[hidden]','.os-member-drawer-footer',
  '.os-member-drawer .invite-form','.os-member-drawer .os-qa-admin',
  '.os-member-search', 'data-active-screen="invitations"',
  '.os-member-record-state[data-kind="invitation"]',
 ])assert.ok(css.includes(part),part);
 assert.match(css,/\[data-ws-screen="invitations"\] \.os-add-fab\{display:none!important\}/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(read('src/client/workspace-layout.js'),/s\.key==="invitations"\?"จัดการสมาชิก"/);
 assert.match(read('playwright.midnight.config.mjs'),/member-invitations\.local\.pw\.mjs/);
});
