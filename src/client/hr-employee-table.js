// HR staff have a payroll history separate from login/role memberships.
// Show every roster row; editing updates only the name, deleting deactivates
// employment without deleting attendance, payroll evidence or Auth accounts.
export function mountHrEmployeeTable({target,token,stationId,employees=[],onChanged=()=>{}}={}){
 if(!target)return;
 const title=document.createElement('header');title.className='os-hr-table-head';
 const heading=document.createElement('h3');heading.textContent='รายชื่อพนักงานทั้งหมด';
 const detail=document.createElement('p');detail.textContent='พนักงานในสถานี รวมผู้ที่ปิดสถานะแล้ว การลบเป็นการหยุดใช้งาน ไม่ลบประวัติเงินเดือน';
 title.append(heading,detail);
 const scroller=document.createElement('div');scroller.className='os-directory-scroll';
 const table=document.createElement('table');table.className='os-directory-table';
 const head=document.createElement('thead'),r=document.createElement('tr');
 for(const t of ['รหัสพนักงาน','ชื่อ','ประเภทค่าจ้าง','รอบจ่าย','สถานะ','จัดการ']){
  const th=document.createElement('th');th.textContent=t;r.append(th);
 }
 head.append(r);table.append(head);
 const rows=document.createElement('tbody');table.append(rows);scroller.append(table);
 const status=document.createElement('p');status.setAttribute('role','status');status.className='os-directory-notice';
 target.replaceChildren(title,scroller,status);
 const make=(tag,text,className)=>{
  const e=document.createElement(tag);e.textContent=text;
  if(className)e.className=className;return e;
 };
 async function change(emp,action,name=null){
  const options={stationId,employeeId:emp.id,action};
  if(action==='edit')options.name=name;
  else options.confirm=true;
  try{
   status.textContent='กำลังบันทึก…';
   const res=await fetch('/api/hr/employee-change',{method:'POST',cache:'no-store',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(options)});
   if(!res.ok){
    const body=await res.json().catch(()=>({}));
    status.textContent=body.error==='future_shift_exists'?
     'ยังมีกะงานในอนาคต กรุณาย้ายหรือยกเลิกกะก่อนปิดพนักงาน':
     'แก้ไขข้อมูลไม่สำเร็จ โปรดตรวจสิทธิ์และสถานะพนักงาน';
    return;
   }
   status.textContent='บันทึกสำเร็จ ประวัติการทำงานและเงินเดือนยังคงอยู่';
   onChanged();
  }catch{status.textContent='ไม่สามารถยืนยันผลการแก้ไขได้ กรุณาโหลดข้อมูลใหม่ก่อนทำซ้ำ';}
 }
 function paint(){
  rows.replaceChildren();
  if(!employees.length){
   const tr=make('tr','');const td=make('td','ยังไม่มีพนักงานในสถานี');
   td.colSpan=6;tr.append(td);rows.append(tr);
  }
  for(const emp of employees){
   const tr=make('tr','');
   const columns=[emp.code,emp.name,emp.wageType,emp.payrollFrequency,
    emp.employmentStatus==='active'?'ใช้งาน':'ปิดใช้งาน'];
   for(const c of columns)tr.append(make('td',String(c||'—')));
   const action=make('td','','os-directory-actions');
   if(emp.employmentStatus==='active'){
    const edit=make('button','แก้ไข','button secondary');
    edit.type='button';
    const stop=make('button','ลบ/ปิดใช้งาน','button secondary');
    stop.type='button';
    edit.addEventListener('click',()=>{
     action.replaceChildren();
     const input=make('input','');input.value=emp.name||'';input.maxLength=200;
     input.setAttribute('aria-label','แก้ไขชื่อพนักงาน '+emp.code);
     const save=make('button','บันทึก','button primary');save.type='button';
     const cancel=make('button','ยกเลิก','button secondary');cancel.type='button';
     cancel.addEventListener('click',paint);
     save.addEventListener('click',()=>change(emp,'edit',input.value.trim()));
     action.append(input,save,cancel);input.focus();
    });
    stop.addEventListener('click',()=>{
     if(window.confirm('ปิดสถานะพนักงาน '+emp.name+
       '? ประวัติเงินเดือนและกะจะไม่ถูกลบ และหากมีกะอนาคตระบบจะปฏิเสธ'))
      change(emp,'deactivate');
    });
    action.append(edit,stop);
   }else action.append(make('small','—'));
   tr.append(action);rows.append(tr);
  }
 }
 paint();
 return {refresh:(next=[])=>{employees=next;paint();}};
}
