import {makeIcon} from './icons.js';

// Login memberships are distinct from HR employees and payroll history.
// The trusted API, not the browser, enforces tenant and role authorization.
const ROLES=Object.freeze({
 station:[['manager','ผู้จัดการ'],['cashier','แคชเชียร์'],
  ['attendant','พนักงานปั๊ม'],['pump_staff','พนักงานหน้าลาน'],
  ['hr_manager','ผู้จัดการฝ่ายบุคคล'],['finance_manager','ผู้จัดการการเงิน']],
 corporate_company:[['accountant','พนักงานบัญชี'],
  ['coupon_issuer','ผู้ออกคูปอง'],['driver','คนขับรถ'],
  ['finance_manager','ผู้จัดการการเงิน']],
});
const ROLE_LABELS=Object.freeze({
 station_owner:'เจ้าของสถานี',owner:'เจ้าของบัญชี',
 corporate_admin:'ผู้ดูแลบริษัท',organization_owner:'เจ้าขององค์กร',
 organization_manager:'ผู้จัดการองค์กร',platform_superadmin:'ผู้ดูแลระบบ',
 platform_sales:'ฝ่ายขาย',platform_support:'ฝ่ายสนับสนุน',
});
export const memberRoleLabel=(role,scopeType)=>
 ROLES[scopeType]?.find(([code])=>code===role)?.[1]||ROLE_LABELS[role]||role||'—';
const PROTECTED=new Set(['station_owner','owner','corporate_admin']);
const statusText=active=>active?'ใช้งาน':'ปิดสิทธิ์แล้ว';
const node=(tag,cls,text)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==undefined)e.textContent=text;
 return e;
};
const actionButton=(icon,text,cls='os-directory-icon-button')=>{
 const e=node('button',cls);e.type='button';
 e.setAttribute('aria-label',text);e.title=text;
 e.append(makeIcon(icon));return e;
};
async function authorizedRequest(url,token,init={}){
 const response=await fetch(url,{...init,headers:{
  authorization:'Bearer '+token,...(init.headers||{})},cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'service_unavailable');
 return body;
}
const failureMessage=error=>({
 driver_has_active_coupon:'คนขับยังมีคูปองใช้งานอยู่ ต้องจัดการคูปองก่อน',
 permission_denied:'บัญชีนี้ไม่มีสิทธิ์แก้ไขสมาชิกดังกล่าว',
 invalid_member_change:'ไม่สามารถเปลี่ยนเป็นบทบาทที่เลือกได้',
 employee_already_inactive:'บัญชีถูกปิดสิทธิ์ไปแล้ว กรุณาโหลดข้อมูลใหม่',
})[error?.message]||'ดำเนินการไม่สำเร็จ โปรดตรวจสิทธิ์และลองโหลดข้อมูลใหม่';

export function mountMemberDirectory({target,token,scopeType,scopeId,canChange=false,onLoaded=()=>{}}={}){
 if(!target||!token||!scopeId||!ROLES[scopeType])return null;
 const controls=node('div','os-directory-controls');
 const search=node('input','os-directory-search');
 search.type='search';search.placeholder='ค้นหาชื่อ อีเมล หรือบทบาท';
 search.setAttribute('aria-label','ค้นหาชื่อ อีเมล หรือบทบาท');
 const role=node('select','os-directory-filter');
 role.setAttribute('aria-label','กรองตามบทบาท');
 const state=node('select','os-directory-filter');
 state.setAttribute('aria-label','กรองตามสถานะ');
 for(const [value,text] of [['all','ทุกสถานะ'],['active','ใช้งาน'],['inactive','ปิดสิทธิ์แล้ว']]){
  const opt=node('option',null,text);opt.value=value;state.append(opt);
 }
 const order=node('select','os-directory-filter os-directory-sort');
 order.setAttribute('aria-label','เรียงลำดับสมาชิก');
 for(const [value,text] of [['name','ชื่อ ก–ฮ'],['newest','เพิ่มล่าสุด']]){
  const opt=node('option',null,text);opt.value=value;order.append(opt);
 }
 const refresh=actionButton('refresh','โหลดรายชื่อใหม่');
 refresh.classList.add('os-directory-refresh');
 controls.append(search,role,state,order,refresh);
 const notice=node('p','os-directory-notice');
 notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const panel=node('div','os-directory-scroll');
 panel.tabIndex=0;panel.setAttribute('role','region');
 panel.setAttribute('aria-label','ตารางบัญชีผู้ใช้งาน เลื่อนในแนวนอนบนหน้าจอแคบ');
 const table=node('table','os-directory-table');
 const head=node('thead'),headRow=node('tr');
 for(const text of ['ชื่อสมาชิก','อีเมล','บทบาท','สถานะ','จัดการ']){
  const th=node('th',null,text);th.scope='col';headRow.append(th);
 }
 head.append(headRow);table.append(head);
 const tbody=node('tbody');table.append(tbody);panel.append(table);
 const dialog=node('dialog','os-directory-dialog');
 dialog.setAttribute('aria-labelledby','os-directory-dialog-title');
 const dialogTitle=node('h3',null,'แก้ไขสมาชิก');dialogTitle.id='os-directory-dialog-title';
 const dialogInfo=node('p','os-directory-dialog-info');
 const roleLabel=node('label','os-directory-field','บทบาทใหม่');
 const roleChoice=node('select','os-directory-role');
 roleLabel.append(roleChoice);
 const warning=node('p','os-directory-warning');
 const dialogActions=node('div','os-directory-dialog-actions');
 const cancel=node('button','button secondary','ยกเลิก');cancel.type='button';
 const save=node('button','button primary','บันทึก');save.type='button';
 dialogActions.append(cancel,save);
 dialog.append(dialogTitle,dialogInfo,roleLabel,warning,dialogActions);
 target.replaceChildren(controls,notice,panel,dialog);

 let members=[],reading=false,busy=false,action=null;
 const protectedRole=m=>PROTECTED.has(m.role)||
  !ROLES[scopeType].some(([key])=>key===m.role);
 const selectedRows=()=>{
  const query=search.value.trim().toLocaleLowerCase('th');
  return members.filter(m=>
   (state.value==='all'||(state.value==='active')===Boolean(m.active))&&
   (role.value==='all'||role.value===m.role)&&
   [m.displayName,m.email,memberRoleLabel(m.role,scopeType),statusText(m.active)]
    .join(' ').toLocaleLowerCase('th').includes(query))
   .sort((a,b)=>order.value==='newest'?
    String(b.joinedAt||'').localeCompare(String(a.joinedAt||''))||
      String(a.displayName||'').localeCompare(String(b.displayName||''),'th'):
    String(a.displayName||'').localeCompare(String(b.displayName||''),'th')||
      String(a.membershipId||'').localeCompare(String(b.membershipId||'')));
 };
 function populateRoleFilter(){
  const previous=role.value||'all';
  role.replaceChildren();
  const all=node('option',null,'ทุกบทบาท');all.value='all';role.append(all);
  for(const code of [...new Set(members.map(m=>m.role))].sort((a,b)=>
    memberRoleLabel(a,scopeType).localeCompare(memberRoleLabel(b,scopeType),'th'))){
   const opt=node('option',null,memberRoleLabel(code,scopeType));
   opt.value=code;role.append(opt);
  }
  role.value=[...role.options].some(x=>x.value===previous)?previous:'all';
 }
 function render(){
  tbody.replaceChildren();
  const rows=selectedRows();
  if(!rows.length){
   const row=node('tr'),cell=node('td','os-directory-empty',
    members.length?'ไม่พบสมาชิกที่ตรงกับตัวกรอง':'ยังไม่มีบัญชีผู้ใช้งานในขอบเขตนี้');
   cell.colSpan=5;row.append(cell);tbody.append(row);
  }
  for(const member of rows){
   const row=node('tr');
   const name=node('td','os-directory-person');
   const person=node('div','os-directory-person-wrap');
   const avatar=node('span','os-directory-avatar',
    String(member.displayName||member.email||'?').trim().charAt(0).toLocaleUpperCase('th'));
   avatar.setAttribute('aria-hidden','true');
   person.append(avatar,node('strong',null,member.displayName||'—'));
   name.append(person);row.append(name);
   row.append(node('td','os-directory-email',member.email||'—'));
   row.append(node('td','os-directory-role-label',memberRoleLabel(member.role,scopeType)));
   const status=node('td'),pill=node('span','os-directory-state',statusText(member.active));
   pill.dataset.state=member.active?'active':'inactive';status.append(pill);row.append(status);
   const cell=node('td','os-directory-actions');
   if(member.active&&canChange&&!protectedRole(member)){
    const edit=actionButton('edit','แก้ไขบทบาท '+member.displayName);
    const deactivate=actionButton('user-minus','ปิดสิทธิ์ '+member.displayName);
    deactivate.classList.add('os-directory-danger-action');
    edit.addEventListener('click',()=>openDialog(member,'edit'));
    deactivate.addEventListener('click',()=>openDialog(member,'deactivate'));
    cell.append(edit,deactivate);
   }else{
    const reason=protectedRole(member)?'บัญชีที่ได้รับการป้องกัน':
     !member.active?'ปิดสิทธิ์แล้ว':'ดูได้อย่างเดียว';
    const badge=node('span','os-directory-protected',reason);
    if(protectedRole(member))badge.prepend(makeIcon('shield'));
    cell.append(badge);
   }
   row.append(cell);tbody.append(row);
  }
 }
 function openDialog(member,kind){
  if(busy||!member.active||!canChange||protectedRole(member))return;
  action={member,kind};
  const edit=kind==='edit';
  dialogTitle.textContent=edit?'แก้ไขบทบาทสมาชิก':'ยืนยันปิดสิทธิ์การใช้งาน';
  dialogInfo.textContent=edit?
   member.displayName+' · บทบาทปัจจุบัน: '+memberRoleLabel(member.role,scopeType):
   'ต้องการปิดสิทธิ์ของ '+member.displayName+' เฉพาะบัญชีในขอบเขตนี้หรือไม่?';
  roleChoice.replaceChildren();
  for(const [code,label] of ROLES[scopeType]){
   const opt=node('option',null,label);opt.value=code;roleChoice.append(opt);
  }
  roleChoice.value=member.role;
  roleLabel.hidden=!edit;
  warning.hidden=edit;
  warning.textContent=edit?'':'การปิดสิทธิ์ไม่ลบบัญชี Auth ประวัติเติมน้ำมัน กะ หรือเงินเดือน และคนขับที่มีคูปองค้างจะถูกปฏิเสธ';
  save.textContent=edit?'บันทึกบทบาท':'ยืนยันปิดสิทธิ์';
  save.className=edit?'button primary':'button destructive';
  dialog.showModal();
  (edit?roleChoice:save).focus();
 }
 cancel.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{action=null;});
 save.addEventListener('click',async()=>{
  if(!action||busy)return;
  const {member,kind}=action;
  if(kind==='edit'&&roleChoice.value===member.role){dialog.close();return;}
  busy=true;save.disabled=true;cancel.disabled=true;refresh.disabled=true;
  notice.textContent='กำลังบันทึกการเปลี่ยนแปลง…';
  try{
   await authorizedRequest('/api/members/change',token,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({membershipId:member.membershipId,action:kind,
     ...(kind==='edit'?{roleCode:roleChoice.value}:{confirm:true})}),
   });
   dialog.close();
   await reload();
   notice.textContent=kind==='edit'?'ปรับบทบาทเรียบร้อยแล้ว':'ปิดสิทธิ์เรียบร้อยแล้ว โดยไม่ลบประวัติ';
  }catch(error){
   notice.textContent=failureMessage(error);
  }finally{
   busy=false;save.disabled=false;cancel.disabled=false;refresh.disabled=false;
  }
 });
 async function reload(){
  if(reading)return;
  reading=true;refresh.disabled=true;
  notice.textContent='กำลังโหลดบัญชีผู้ใช้งาน…';
  try{
   const params=new URLSearchParams({scopeType,scopeId});
   const result=await authorizedRequest('/api/members/directory?'+params,token);
   if(!Array.isArray(result.members))throw Error('invalid_response');
   members=result.members;
   populateRoleFilter();render();onLoaded(members.length);
   notice.textContent='แสดง '+selectedRows().length+' จาก '+members.length+' บัญชี · รวมบัญชีที่ปิดสิทธิ์';
  }catch{
   notice.textContent='ไม่สามารถโหลดข้อมูลได้ โปรดตรวจสิทธิ์หรือการเชื่อมต่อแล้วลองใหม่';
   if(!members.length)render();
   onLoaded(null);
  }finally{reading=false;refresh.disabled=busy;}
 }
 function filter(){render();notice.textContent='แสดง '+selectedRows().length+' จาก '+members.length+' บัญชี';}
 search.addEventListener('input',filter);
 role.addEventListener('change',filter);
 state.addEventListener('change',filter);
 order.addEventListener('change',filter);
 refresh.addEventListener('click',reload);
 reload();
 return {reload};
}
