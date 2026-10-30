import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderLogoutDialog,wireLogoutDialog} from '../../src/client/logout-dialog.js';
import {renderWorkspaceShell,selectWorkspaceScreens} from '../../src/client/workspace-layout.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const owner={scopeType:'station',role:'station_owner',stationId:'s'};
test('logout confirmation is OilStation branded and never reveals browser domain',()=>{
 const html=renderLogoutDialog();
 assert.match(html,/<dialog class="os-logout-dialog"/);
 assert.match(html,/aria-labelledby="os-logout-title"/);
 assert.match(html,/aria-describedby="os-logout-description"/);
 assert.match(html,/data-ui-icon="power"/);
 assert.match(html,/data-logout-cancel>ยกเลิก/);
 assert.match(html,/data-logout-confirm/);
 assert.match(html,/ออกจากระบบ/);
 assert.doesNotMatch(html,/oilstation\.goldensoft\.cloud บอกว่า|window\.confirm/);
 const shell=renderWorkspaceShell(selectWorkspaceScreens([owner]));
 assert.match(shell,/data-logout-dialog/);
 assert.equal((shell.match(/data-logout-dialog/g)||[]).length,1);
});
class TestElement{
 constructor(){
  this.listeners={};this.dataset={};this.hidden=true;this.disabled=false;
  this.open=false;this.isConnected=true;this.focused=false;this.textContent='';
 }
 addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
 dispatchEvent(event){for(const fn of this.listeners[event.type]??[])fn(event);return true;}
 click(){this.dispatchEvent({type:'click',target:this});}
 focus(){this.focused=true;}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent({type:'close'});}
}
function setup(){
 const dialog=new TestElement(),shell=new TestElement(),cancel=new TestElement(),
  confirm=new TestElement(),feedback=new TestElement(),power=new TestElement(),sidebar=new TestElement();
 const map={'[data-logout-dialog]':dialog,'[data-workspace-shell]':shell,
  '[data-logout-cancel]':cancel,'[data-logout-confirm]':confirm,
  '[data-logout-feedback]':feedback};
 const root={querySelector:s=>map[s],querySelectorAll:s=>
  s==='[data-mobile-logout],#logout'?[power,sidebar]:[]};
 let sent=0;shell.addEventListener('oilstation:logoutrequested',()=>sent++);
 wireLogoutDialog(root);
 return {dialog,shell,cancel,confirm,feedback,power,sidebar,sent:()=>sent};
}
test('cancel never signs out, dialog is reusable and returns focus to opener',()=>{
 const ui=setup();
 ui.power.click();
 assert.equal(ui.dialog.open,true);
 assert.equal(ui.cancel.focused,true);
 assert.equal(ui.sent(),0);
 ui.cancel.click();
 assert.equal(ui.dialog.open,false);
 assert.equal(ui.sent(),0);
 assert.equal(ui.power.focused,true);
 ui.sidebar.click();
 assert.equal(ui.dialog.open,true);
 assert.equal(ui.sent(),0);
});
test('confirm signs out once and holds buttons while request is in flight',()=>{
 const ui=setup();
 ui.power.click();
 ui.confirm.click();ui.confirm.click();
 assert.equal(ui.sent(),1);
 assert.equal(ui.confirm.disabled,true);
 assert.equal(ui.cancel.disabled,true);
 assert.equal(ui.dialog.dataset.busy,'true');
 assert.match(ui.feedback.textContent,/กำลังออกจากระบบ/);
 const event={type:'cancel',preventDefault(){this.prevented=true;}};
 ui.dialog.dispatchEvent(event);
 assert.equal(event.prevented,true);
 assert.equal(ui.dialog.open,true);
});
test('logout failure shows inline Thai recovery and permits another attempt',()=>{
 const ui=setup();
 ui.sidebar.click();ui.confirm.click();
 ui.shell.dispatchEvent({type:'oilstation:logoutfailed'});
 assert.equal(ui.confirm.disabled,false);
 assert.equal(ui.cancel.disabled,false);
 assert.equal(ui.dialog.dataset.busy,'false');
 assert.equal(ui.feedback.dataset.tone,'error');
 assert.match(ui.feedback.textContent,/ลองอีกครั้ง/);
 ui.confirm.click();
 assert.equal(ui.sent(),2);
});
test('dialog styling uses OilStation Teal, responsive widths and top-layer backdrop',()=>{
 const css=read('public/mobile-app.css');
 assert.match(css,/\.os-logout-dialog::backdrop/);
 assert.match(css,/\.os-logout-confirm/);
 assert.match(css,/width:min\(400px,calc\(100vw - 32px\)\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 const layout=read('src/client/workspace-layout.js');
 assert.doesNotMatch(layout,/window\.confirm\(/);
 assert.match(layout,/wireLogoutDialog\(root\)/);
 const main=read('src/client/main.js');
 const signout=main.slice(main.indexOf('let signingOut=false;'),main.indexOf('async function couponViewer('));
 assert.doesNotMatch(signout,/window\.alert/);
 assert.match(signout,/authClient\.auth\.signOut\(\)/);
 assert.match(signout,/if\(error\)throw error/);
 assert.match(signout,/oilstation:logoutfailed/);
});
