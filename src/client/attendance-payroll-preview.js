/** Station-local reviewed attendance preview; not a payroll or salary approval. */
export function mountAttendancePayrollPreview({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const wrap=document.createElement('section');wrap.className='attendance-payroll-preview';
 const heading=document.createElement('h3');heading.textContent='ตัวอย่างชั่วโมงทำงานที่ผ่านการตรวจสอบ';
 const hint=document.createElement('p');hint.className='hint';
 hint.textContent='เฉพาะเวลาที่หัวหน้างานอนุมัติพร้อมหลักฐาน · ไม่มีการสร้างเงินเดือนหรือคำสั่งจ่าย';
 const form=document.createElement('form');form.className='coupon-form';
 const employeeLabel=document.createElement('label');employeeLabel.className='field';
 employeeLabel.append(document.createTextNode('พนักงาน'));
 const employee=document.createElement('select');employee.required=true;
 employee.setAttribute('aria-label','เลือกพนักงานเพื่อดูเวลา');employeeLabel.append(employee);
 const startLabel=document.createElement('label');startLabel.className='field';
 startLabel.append(document.createTextNode('วันเริ่มต้นตามเวลาท้องถิ่นของปั๊ม'));
 const start=document.createElement('input');start.type='date';start.required=true;startLabel.append(start);
 const endLabel=document.createElement('label');endLabel.className='field';
 endLabel.append(document.createTextNode('วันสิ้นสุด (ไม่รวมวันนั้น)'));
 const end=document.createElement('input');end.type='date';end.required=true;endLabel.append(end);
 const reload=document.createElement('button');reload.type='button';
 reload.className='button secondary';reload.textContent='โหลดรายชื่อพนักงาน';
 const submit=document.createElement('button');submit.type='submit';
 submit.className='button primary';submit.textContent='ดูเวลาทำงานที่ตรวจสอบแล้ว';
 const notice=document.createElement('p');notice.setAttribute('role','status');
 form.append(employeeLabel,startLabel,endLabel,reload,submit);
 wrap.append(heading,hint,form,notice);target.append(wrap);
 async function loadEmployees(){
  reload.disabled=true;notice.textContent='กำลังโหลดรายชื่อพนักงาน…';
  try{
   const r=await fetch('/api/hr/roster?stationId='+encodeURIComponent(stationId),{
    cache:'no-store',headers:{authorization:'Bearer '+token}});
   if(!r.ok)throw new Error('not_authorized');
   const roster=(await r.json()).roster;
   const current=employee.value;employee.replaceChildren();
   for(const e of roster?.employees||[]){
    const o=document.createElement('option');o.value=e.id;
    o.textContent=e.name+' ('+e.code+')';employee.append(o);
   }
   if([...employee.options].some(o=>o.value===current))employee.value=current;
   notice.textContent=employee.options.length?'เลือกช่วงวันและกดดูเวลาทำงาน':'ไม่มีพนักงานที่ดูได้';
  }catch{notice.textContent='โหลดรายชื่อไม่ได้ กรุณาตรวจสิทธิ์การจัดการพนักงาน';}
  finally{reload.disabled=false;}
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!employee.value||!start.value||!end.value||end.value<=start.value){
   notice.textContent='โปรดเลือกพนักงานและช่วงวันที่สิ้นสุดหลังวันเริ่มต้น';return;
  }
  submit.disabled=true;notice.textContent='กำลังตรวจสอบการอนุมัติและคำนวณเวลา…';
  try{
   const qs=new URLSearchParams({employeeId:employee.value,
    startDate:start.value,endDate:end.value});
   const r=await fetch('/api/hr/attendance/payroll-preview?'+qs.toString(),{
    cache:'no-store',headers:{authorization:'Bearer '+token}});
   if(!r.ok)throw new Error('punches_not_approved');
   const result=await r.json();
   if(result.status!=='preview_only'||result.payable!==false||
       result.faceVerified!==false||!Number.isInteger(result.workedMinutes))
    throw new Error('invalid_preview');
   notice.textContent='เวลาที่ตรวจสอบแล้ว '+result.workedMinutes+
    ' นาที · เวลาพัก '+result.breakMinutes+' นาที · '+result.shifts+
    ' กะ (ตัวอย่างเพื่อทบทวนเท่านั้น ยังไม่ใช่รายการจ่ายเงินเดือน)';
  }catch{
   notice.textContent='ยังคำนวณไม่ได้: มีเวลาที่รออนุมัติ ปฏิเสธ หลักฐานไม่ครบ หรือกะเข้าออกไม่สมบูรณ์';
  }finally{submit.disabled=false;}
 });
 reload.addEventListener('click',loadEmployees);
 loadEmployees().catch(()=>{notice.textContent='โหลดข้อมูลไม่ได้';});
}
