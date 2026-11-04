import {makeIcon} from './icons.js';
import {mountMemberDirectory} from './member-directory.js';

// Invitation admin is deliberately list-first. The existing approved invitation
// and QA Auth forms remain mounted (only hidden) so validation, pending values
// and their original server-side authorization are not bypassed.
//
// There is currently no tenant-scoped member directory API. Show ONLY items
// successfully created in this browser view, clearly labeled as session activity.
// Do not invent users, fetch other tenants, or misstate this as a complete roster.
const el=(tag,className,text)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
};
const button=(className,text,icon)=>{
 const node=el('button',className);
 node.type='button';
 if(icon)node.append(makeIcon(icon));
 node.append(document.createTextNode(text));
 return node;
};

export function mountMemberInvitations({target,inviteControl=null,qaHost=null,readOnlyMessage='',
  token=null,scopeType=null,scopeId=null,canChange=false}={}){
 if(!target)return;
 const page=el('div','os-member-page');
 const toolbar=el('header','os-member-toolbar');
 const intro=el('div','os-member-intro');
 intro.append(el('p','os-member-eyebrow','สมาชิกและสิทธิ์'),
  el('h3','os-member-toolbar-title','เชิญและจัดการสิทธิ์'),
  el('p','os-member-intro-copy','จัดการการเชิญและบัญชีทดสอบภายในขอบเขตที่ได้รับอนุญาต'));
 toolbar.append(intro);
 const canManage=Boolean(inviteControl||qaHost);
 let create=null,dialog=null;
 if(canManage){
  create=button('button primary os-member-create','เพิ่มสมาชิก','user-plus');
  create.setAttribute('aria-haspopup','dialog');
  toolbar.append(create);
 }
 page.append(toolbar);
 const list=el('section','os-member-list');
 list.setAttribute('aria-label','รายการที่สร้างจากหน้านี้');
 const head=el('header','os-member-list-head');
 const copy=el('div');
 copy.append(el('h3',null,'รายการล่าสุด'),el('p',null,
  'แสดงคำเชิญและบัญชี QA ที่สร้างสำเร็จในหน้านี้เท่านั้น ไม่ใช่รายชื่อสมาชิกทั้งหมดของบริษัท'));
 head.append(copy);
 const badge=el('span','os-member-count','0 รายการ');
 head.append(badge);list.append(head);
 const search=el('input','os-member-search');
 search.type='search';search.placeholder='ค้นหารายการที่สร้างในหน้านี้…';
 search.setAttribute('aria-label','ค้นหารายการที่สร้างในหน้านี้');
 list.append(search);
 const records=el('div','os-member-records');
 records.setAttribute('aria-live','polite');list.append(records);
 const entries=[];
 function render(){
  const query=search.value.trim().toLocaleLowerCase('th');
  records.replaceChildren();
  const filtered=entries.filter(x=>
   (x.name+' '+x.role+' '+x.state).toLocaleLowerCase('th').includes(query));
  badge.textContent=entries.length+' รายการ';
  if(!filtered.length){
   const empty=el('div','os-member-empty');
   empty.append(makeIcon('users'));
   empty.append(el('strong',null,entries.length?'ไม่พบรายการที่ค้นหา':'ยังไม่มีรายการใหม่ในหน้านี้'));
   empty.append(el('p',null,entries.length?
    'ลองเปลี่ยนคำค้นหา':'กด “เพิ่มสมาชิก” เพื่อสร้างคำเชิญหรือบัญชี QA รายการใหม่จะแสดงเมื่อระบบยืนยันสำเร็จ'));
   records.append(empty);return;
  }
  for(const item of filtered){
   const row=el('div','os-member-record');
   const icon=el('span','os-member-avatar');
   icon.append(makeIcon(item.kind==='qa'?'users':'mail'));
   const detail=el('div','os-member-record-copy');
   detail.append(el('strong',null,item.name),el('small',null,item.role));
   const tag=el('span','os-member-record-state',item.state);
   tag.dataset.kind=item.kind;
   row.append(icon,detail,tag);records.append(row);
  }
 }
 search.addEventListener('input',render);
 if(readOnlyMessage){
  const note=el('p','os-member-readonly',readOnlyMessage);
  list.append(note);
 }
 render();
 page.append(list);
 let directory=null;
 if(token&&scopeId&&['station','corporate_company'].includes(scopeType)){
  // The live directory replaces the session-only activity placeholders.
  search.hidden=true;records.hidden=true;
  const directoryTarget=el('div','os-member-directory-host');
  list.append(directoryTarget);
  directory=mountMemberDirectory({
   target:directoryTarget,token,scopeType,scopeId,canChange,
   onLoaded:count=>{
    head.querySelector('h3').textContent='รายชื่อพนักงานและสมาชิก';
    head.querySelector('p').textContent='แสดงสมาชิกในขอบเขตของคุณ รวมผู้ใช้ที่ปิดสิทธิ์แล้ว';
    badge.textContent=count===null?'ไม่พร้อมใช้งาน':count+' รายการ';
   },
  });
 }
 if(canManage){
  dialog=el('dialog','os-member-drawer');
  dialog.setAttribute('aria-labelledby','os-member-drawer-title');
  const panel=el('div','os-member-drawer-panel');
  const drawerHead=el('div','os-member-drawer-head');
  const titleBox=el('div');
  titleBox.append(el('p','os-member-eyebrow','จัดการสิทธิ์ตามบทบาท'),
   el('h3',null,'เพิ่มสมาชิก'));
  titleBox.querySelector('h3').id='os-member-drawer-title';
  const close=button('os-member-close','ปิด');
  close.setAttribute('aria-label','ปิดหน้าต่างเพิ่มสมาชิก');
  drawerHead.append(titleBox,close);
  const nav=el('div','os-member-kind-tabs');
  nav.setAttribute('role','tablist');
  nav.setAttribute('aria-label','วิธีเพิ่มสมาชิก');
  const body=el('div','os-member-drawer-body');
  const tabs=[];
  function addTab(key,label,content){
   const tab=button('os-member-kind-tab',label);
   tab.setAttribute('role','tab');tab.id='os-member-tab-'+key;
   const pane=el('div','os-member-kind-panel');
   pane.dataset.memberKind=key;pane.id='os-member-panel-'+key;
   pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',tab.id);
   tab.setAttribute('aria-controls',pane.id);
   tab.addEventListener('click',()=>select(key));
   nav.append(tab);pane.append(content);body.append(pane);
   tabs.push({key,tab,pane});
  }
  if(inviteControl){
   const toggle=inviteControl.querySelector(':scope > button');
   const form=inviteControl.querySelector('.invite-form');
   if(toggle&&form){form.hidden=false;toggle.hidden=true;toggle.setAttribute('aria-expanded','true');}
   addTab('invite','เชิญด้วยอีเมล',inviteControl);
  }
  if(qaHost)addTab('qa','บัญชีทดสอบ QA',qaHost);
  function select(key){
   for(const item of tabs){
    const active=item.key===key;
    item.tab.setAttribute('aria-selected',String(active));
    item.tab.tabIndex=active?0:-1;
    item.pane.hidden=!active;
   }
  }
  select(tabs[0]?.key);
  nav.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const idx=tabs.findIndex(x=>x.tab===document.activeElement);
   if(idx<0)return;
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (idx+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;
   select(tabs[next].key);
   tabs[next].tab.focus();
  });
  const footer=el('div','os-member-drawer-footer');
  const cancel=button('button secondary','กลับไปยังรายการ');
  footer.append(cancel);
  panel.append(drawerHead,nav,body,footer);dialog.append(panel);
  create.addEventListener('click',()=>{
   if(!dialog.open){
    dialog.showModal();
    const selected=tabs.find(t=>t.tab.getAttribute('aria-selected')==='true');
    (selected?.pane.querySelector('input:not([type=hidden]),select')||close).focus();
   }
  });
  const dismiss=()=>dialog.close();
  close.addEventListener('click',dismiss);cancel.addEventListener('click',dismiss);
  dialog.addEventListener('click',event=>{
   if(event.target===dialog)dismiss();
  });
  // Keep the modal mounted; do not close on submission because the created
  // invitation link/copy button must remain available until the user copies it.
  page.addEventListener('oilstation:member-created',event=>{
   const data=event.detail||{};
   if(!['qa','invitation'].includes(data.kind)||typeof data.name!=='string'||!data.name.trim())return;
   entries.unshift({name:data.name.trim().slice(0,128),
    role:String(data.role||'').slice(0,80),
    state:data.kind==='qa'?'สร้างบัญชีแล้ว':'สร้างคำเชิญแล้ว',
    kind:data.kind});
   render();
   directory?.reload();
  });
  page.append(dialog);
 }
 target.replaceChildren(page);
 return {open:()=>create?.click(),count:()=>entries.length};
}
