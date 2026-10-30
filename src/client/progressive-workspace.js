import {makeIcon} from './icons.js';

const TASKS={
 stations:{title:'สร้างปั๊มน้ำมัน',select:screen=>screen.querySelector('#new-station-form'),container:form=>form.closest('.os-create-station')},
 customers:{title:'เพิ่มลูกค้าบริษัท',select:screen=>screen.querySelector('#customer-create')},
 hr:{title:'เพิ่มพนักงาน',select:screen=>screen.querySelector('#hr-add-employee')},
 billing:{title:'เพิ่มแพ็กเกจ',select:screen=>screen.querySelectorAll('form.saas-simple-card')[1]},
};
const activeStates=new WeakMap();

function makeButton(label,icon,classname){
 const button=document.createElement('button');
 button.type='button';button.className=classname;button.setAttribute('aria-label',label);
 button.title=label;
 button.append(makeIcon(icon),document.createElement('span'));
 button.lastElementChild.textContent=label;
 return button;
}
function editableFuelRow(row){
 if(row.dataset.osCardReady)return;
 const controls=row.querySelector('.fuel-row-controls');
 if(!controls)return;
 row.dataset.osCardReady='true';
 row.classList.add('os-record-card');
 const check=controls.querySelector('input[type="checkbox"]');
 const price=controls.querySelector('input:not([type="checkbox"])');
 const summary=document.createElement('p');summary.className='os-record-summary';
 const update=()=>{
  summary.textContent=(check?.checked?'เปิดขาย':'ปิดขาย')+
   ' · '+(price?.value?price.value+' บาท/ลิตร':'ยังไม่กำหนดราคา');
 };
 update();controls.before(summary);
 const edit=makeButton('แก้ไขราคาน้ำมัน','edit','os-card-edit');
 edit.setAttribute('aria-expanded','false');
 controls.hidden=true;
 edit.addEventListener('click',()=>{
  const open=controls.hidden;controls.hidden=!open;
  edit.setAttribute('aria-expanded',String(open));
  edit.querySelector('span').textContent=open?'ปิดการแก้ไข':'แก้ไข';
  if(open)(price||check)?.focus();
 });
 row.append(edit);
 const status=row.querySelector('[role="status"]');
 if(status){
  const observer=new MutationObserver(()=>{
   if(status.dataset.tone==='success')update();
  });
  observer.observe(status,{childList:true,attributes:true,attributeFilter:['data-tone']});
 }
}

function editableTaxCard(screen){
 const form=screen.querySelector('form.saas-simple-card');
 if(!form||form.dataset.osCardReady)return;
 form.dataset.osCardReady='true';form.classList.add('os-editable-card');
 const summary=form.querySelector('.saas-current-summary');
 const controls=[...form.children].filter(el=>el.tagName!=='H3'&&el!==summary);
 controls.forEach(el=>{el.hidden=true;});
 const edit=makeButton('แก้ไขนโยบาย VAT','edit','os-card-edit');
 edit.setAttribute('aria-expanded','false');form.append(edit);
 edit.addEventListener('click',()=>{
  const open=edit.getAttribute('aria-expanded')!=='true';
  controls.forEach(el=>{el.hidden=!open;});
  edit.setAttribute('aria-expanded',String(open));
  edit.querySelector('span').textContent=open?'ปิดการแก้ไข':'แก้ไข';
  if(open)form.querySelector('select,input')?.focus();
 });
}
function enableCreation(screen,key,task){
 const form=task.select(screen);
 if(!form||form.dataset.osCreateReady)return;
 form.dataset.osCreateReady='true';
 const surface=task.container?.(form)||form;
 surface.hidden=true;
 let fab=screen.querySelector(':scope > .os-add-fab');
 if(!fab){
  fab=makeButton(task.title,'plus','os-add-fab');
  fab.setAttribute('aria-expanded','false');
  screen.append(fab);
 }
 fab.setAttribute('aria-controls',form.id||'');
 const close=makeButton('ปิดแบบฟอร์ม','plus','os-add-close');
 // Keep this close button inside the same surface as the actual form.
 surface.insertBefore(close,surface.firstChild);
 const show=()=>{
  surface.hidden=false;
  fab.setAttribute('aria-expanded','true');
  fab.querySelector('span').textContent='ปิด';
  fab.classList.add('is-open');
  form.querySelector('input:not([type="hidden"]),select,textarea')?.focus();
  surface.scrollIntoView?.({block:'start',behavior:'smooth'});
 };
 const hide=()=>{
  surface.hidden=true;
  fab.setAttribute('aria-expanded','false');
  fab.querySelector('span').textContent=task.title;
  fab.classList.remove('is-open');
  fab.focus();
 };
 fab.addEventListener('click',()=>surface.hidden?show():hide());
 close.addEventListener('click',hide);
 // Client-side required validation and server feedback stay inside the form;
 // do not auto-close or clear forms after an unconfirmed network request.
}
function inviteFab(screen){
 const control=screen.querySelector('#member-invites .invite-control');
 if(!control||screen.querySelector(':scope > .os-add-fab'))return;
 const toggle=control.querySelector(':scope > button');
 if(!toggle)return;
 const fab=makeButton('เชิญสมาชิก','plus','os-add-fab');
 fab.addEventListener('click',()=>{
  toggle.click();
  const open=toggle.getAttribute('aria-expanded')==='true';
  fab.setAttribute('aria-expanded',String(open));
 });
 screen.append(fab);
}
function enhance(root){
 for(const screen of root.querySelectorAll('[data-ws-screen]')){
  const key=screen.dataset.wsScreen;
  const task=TASKS[key];
  if(task)enableCreation(screen,key,task);
  if(key==='billing')editableTaxCard(screen);
  if(key==='invitations')inviteFab(screen);
  for(const row of screen.querySelectorAll('.fuel-row'))editableFuelRow(row);
 }
}
export function installProgressiveWorkspace(root){
 const prior=activeStates.get(root);
 if(prior)prior.disconnect();
 const observer=new MutationObserver(()=>{
  if(root.classList.contains('workspace-mode'))enhance(root);
 });
 observer.observe(root,{childList:true,subtree:true});
 activeStates.set(root,observer);
 queueMicrotask(()=>enhance(root));
}
