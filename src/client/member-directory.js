// Membership (login accounts) is NOT the HR payroll employee ledger.
// Mutations edit a role or soft-deactivate exactly one tenant membership.
const el=(tag,cls,text)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==undefined)e.textContent=text;
 return e;
};
const ROLES={
 station:[['manager','ผู้จัดการ'],['cashier','แคชเชียร์'],['attendant','พนักงานปั๊ม'],
  ['pump_staff','พนักงานหน้าลาน'],['hr_manager','ผู้จัดการ HR'],
  ['finance_manager','ผู้จัดการการเงิน']],
 corporate_company:[['accountant','พนักงานบัญชี'],['coupon_issuer','ผู้ออกคูปอง'],
  ['driver','คนขับรถ'],['finance_manager','ผู้จัดการการเงิน']],
};
const PROTECTED=new Set(['station_owner','owner','corporate_admin']);
const statusText=(active)=>active?'ใช้งาน':'ปิดสิทธิ์แล้ว';
async function authorizedRequest(url,token,init={}){
 const response=await fetch(url,{...init,headers:{
  authorization:'Bearer '+token,...(init.headers||{})},cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'service_unavailable');
 return body;
}
export function mountMemberDirectory({target,token,scopeType,scopeId,canChange=false,onLoaded=()=>{}}={}){
 if(!target||!token||!scopeId||!ROLES[scopeType])return null;
 const search=el('input','os-directory-search');
 search.type='search';search.placeholder='ค้นหาชื่อ อีเมล หรือบทบาท';
 search.setAttribute('aria-label','ค้นหารายชื่อสมาชิกทั้งหมด');
 const panel=el('div','os-directory-scroll');
 const table=el('table','os-directory-table');
 const head=el('thead'),tr=el('tr');
 for(const text of ['ชื่อสมาชิก','อีเมล','บทบาท','สถานะ','จัดการ']){
  tr.append(el('th',null,text));
 }
 head.append(tr);table.append(head);
 const body=el('tbody');table.append(body);panel.append(table);
 const notice=el('p','os-directory-notice');
 notice.setAttribute('role','status');
 const controls=el('div','os-directory-controls');
 const refresh=el('button','button secondary','โหลดรายชื่อใหม่');refresh.type='button';
 controls.append(search,refresh);
 target.append(controls,notice,panel);
 let members=[];
 let reading=false;
 const roleName=role=>ROLES[scopeType].find(([key])=>key===role)?.[1]||role;
 function render(){
  body.replaceChildren();
  const q=search.value.trim().toLocaleLowerCase('th');
  const rows=members.filter(m=>[m.displayName,m.email,m.role,statusText(m.active)]
   .join(' ').toLocaleLowerCase('th').includes(q));
  if(!rows.length){
   const r=el('tr');const td=el('td','os-directory-empty',
    members.length?'ไม่พบสมาชิกตามคำค้นหา':'ยังไม่มีรายชื่อสมาชิกในขอบเขตนี้');
   td.colSpan=5;r.append(td);body.append(r);
  }
  for(const m of rows){
   const row=el('tr');
   row.append(el('td',null,m.displayName||'—'),el('td',null,m.email||'—'),
    el('td',null,roleName(m.role)));
   const state=el('td');const pill=el('span','os-directory-state',statusText(m.active));
   pill.dataset.state=m.active?'active':'inactive';state.append(pill);row.append(state);
   const action=el('td','os-directory-actions');
   if(m.active&&canChange&&!PROTECTED.has(m.role)){
    const edit=el('button','button secondary os-directory-edit','แก้ไข');
    edit.type='button';edit.setAttribute('aria-label','แก้ไขบทบาท '+m.displayName);
    const deactivate=el('button','button secondary os-directory-remove','ลบสิทธิ์');
    deactivate.type='button';deactivate.setAttribute('aria-label','ลบสิทธิ์ '+m.displayName);
    edit.addEventListener('click',()=>openEditor(m,action));
    deactivate.addEventListener('click',()=>deactivateMember(m));
    action.append(edit,deactivate);
   }else action.append(el('small',null,'—'));
   row.append(action);body.append(row);
  }
 }
 function openEditor(m,action){
  action.replaceChildren();
  const select=el('select','os-directory-role');
  select.setAttribute('aria-label','เลือกบทบาทใหม่สำหรับ '+m.displayName);
  for(const [code,name] of ROLES[scopeType]){
   const o=el('option',null,name);o.value=code;select.append(o);
  }
  select.value=m.role;
  const save=el('button','button primary','บันทึก');save.type='button';
  const cancel=el('button','button secondary','ยกเลิก');cancel.type='button';
  cancel.addEventListener('click',render);
  save.addEventListener('click',async()=>{
   if(!select.value||select.value===m.role){render();return;}
   save.disabled=true;cancel.disabled=true;notice.textContent='กำลังบันทึกบทบาท…';
   try{
    await authorizedRequest('/api/members/change',token,{
     method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({membershipId:m.membershipId,action:'edit',roleCode:select.value}),
    });
    notice.textContent='บันทึกบทบาทสำเร็จ';await reload();
   }catch{notice.textContent='แก้ไขไม่สำเร็จ โปรดตรวจสิทธิ์และรายการที่ค้างอยู่';render();}
  });
  action.append(select,save,cancel);select.focus();
 }
 async function deactivateMember(m){
  if(!window.confirm('ลบสิทธิ์การเข้าใช้งานของ '+m.displayName+
   ' ในขอบเขตนี้? ประวัติการเงินและเงินเดือนจะไม่ถูกลบ'))return;
  notice.textContent='กำลังปิดสิทธิ์…';
  try{
   await authorizedRequest('/api/members/change',token,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({membershipId:m.membershipId,action:'deactivate',confirm:true}),
   });
   notice.textContent='ปิดสิทธิ์แล้ว ประวัติการทำงานยังคงอยู่';await reload();
  }catch{notice.textContent='ไม่สามารถปิดสิทธิ์ได้ อาจมีคูปองคนขับที่ยังใช้งานหรือสิทธิ์ไม่เพียงพอ';}
 }
 async function reload(){
  if(reading)return;reading=true;refresh.disabled=true;
  notice.textContent='กำลังโหลดรายชื่อสมาชิกทั้งหมด…';
  try{
   const params=new URLSearchParams({scopeType,scopeId});
   const result=await authorizedRequest('/api/members/directory?'+params,token);
   if(!Array.isArray(result.members))throw Error('invalid_response');
   members=result.members;
   notice.textContent='แสดงสมาชิก '+members.length+' รายการ · รวมบัญชีที่ปิดสิทธิ์แล้ว';
   render();onLoaded(members.length);
  }catch{
   members=[];body.replaceChildren();
   notice.textContent='ไม่สามารถโหลดรายชื่อสมาชิกได้ โปรดตรวจสิทธิ์หรือการเชื่อมต่อ';
   onLoaded(null);
  }finally{reading=false;refresh.disabled=false;}
 }
 search.addEventListener('input',render);
 refresh.addEventListener('click',reload);reload();
 return {reload};
}
