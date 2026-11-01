/** Fast, review-only payroll worktime flow. Never authorizes a payout. */
export function mountAttendancePayrollPreview({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const wrap=document.createElement('section');wrap.className='attendance-payroll-preview';
 const heading=document.createElement('h3');heading.textContent='ตรวจรอบเงินเดือน 3 ขั้นตอน';
 const hint=document.createElement('p');hint.className='hint';
 hint.textContent='อ่านชั่วโมงที่หัวหน้างานตรวจแล้วเท่านั้น · ยังไม่ใช่รายการจ่ายเงินเดือน';
 const form=document.createElement('form');form.className='coupon-form';
 const employeeLabel=document.createElement('label');employeeLabel.className='field';
 employeeLabel.append(document.createTextNode('1 · เลือกพนักงาน'));
 const employee=document.createElement('select');employee.required=true;
 employee.setAttribute('aria-label','เลือกพนักงานเพื่อดูเวลา');employeeLabel.append(employee);
 const start=document.createElement('input');start.type='date';start.required=true;
 const end=document.createElement('input');end.type='date';end.required=true;
 const period=document.createElement('section');period.className='module-item';
 const periodHeading=document.createElement('strong');periodHeading.textContent='2 · เลือกงวด';
 const thisMonth=document.createElement('button');thisMonth.type='button';
 thisMonth.className='button secondary';thisMonth.textContent='เดือนนี้';
 const prevMonth=document.createElement('button');prevMonth.type='button';
 prevMonth.className='button secondary';prevMonth.textContent='เดือนก่อน';
 const dateCaption=document.createElement('p');dateCaption.className='hint';
 const custom=document.createElement('details');
 const customLabel=document.createElement('summary');
 customLabel.textContent='กำหนดช่วงวันเอง';
 const startLabel=document.createElement('label');startLabel.className='field';
 startLabel.append(document.createTextNode('วันเริ่มต้นตามเวลาท้องถิ่นของปั๊ม'),start);
 const endLabel=document.createElement('label');endLabel.className='field';
 endLabel.append(document.createTextNode('วันสิ้นสุด (ไม่รวมวันนั้น)'),end);
 custom.append(customLabel,startLabel,endLabel);
 period.append(periodHeading,thisMonth,prevMonth,dateCaption,custom);
 const reload=document.createElement('button');reload.type='button';
 reload.className='button secondary';reload.textContent='รีเฟรชรายชื่อ';
 const submit=document.createElement('button');submit.type='submit';
 submit.className='button primary';submit.textContent='3 · ตรวจสรุปเวลาทำงาน';
 const notice=document.createElement('p');notice.setAttribute('role','status');
 notice.setAttribute('aria-live','polite');
 const resultCard=document.createElement('div');resultCard.className='module-item';
 resultCard.hidden=true;
 const resultHeading=document.createElement('strong');
 resultHeading.textContent='ข้อมูลที่ผ่านการตรวจสอบ';
 const resultText=document.createElement('p');
 const resultWarning=document.createElement('p');resultWarning.className='hint';
 resultWarning.textContent='ตัวอย่างเพื่อทบทวนเท่านั้น · ยังไม่ใช่รายการจ่ายเงินเดือน · ไม่สามารถโอนหรือกดอนุมัติเงินได้';
 resultCard.append(resultHeading,resultText,resultWarning);
 const blocked=document.createElement('p');blocked.className='hint';
 blocked.textContent='ก่อนจ่ายจริงยังต้องตรวจการลา ขาดงาน OT เบิกล่วงหน้า ภาษี ประกันสังคม อนุมัติงวดและบัญชีรับเงิน';
 form.append(employeeLabel,period,reload,submit);
 wrap.append(heading,hint,form,notice,resultCard,blocked);target.append(wrap);
 function monthWindow(offset=0){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'numeric'})
   .formatToParts(new Date());
  const year=Number(parts.find(p=>p.type==='year').value);
  const month=Number(parts.find(p=>p.type==='month').value);
  const first=new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10);
  const after=new Date(Date.UTC(year,month+offset,1)).toISOString().slice(0,10);
  return {first,after};
 }
 function setMonth(offset){
  const range=monthWindow(offset);
  start.value=range.first;end.value=range.after;
  thisMonth.setAttribute('aria-pressed',String(offset===0));
  prevMonth.setAttribute('aria-pressed',String(offset===-1));
  dateCaption.textContent='เลือกแล้ว: '+start.value+' ถึง '+end.value+' (ไม่รวมวันสิ้นสุด)';
  resultCard.hidden=true;
 }
 thisMonth.addEventListener('click',()=>setMonth(0));
 prevMonth.addEventListener('click',()=>setMonth(-1));
 start.addEventListener('change',()=>{dateCaption.textContent='กำหนดเอง: '+start.value+' ถึง '+end.value;});
 end.addEventListener('change',()=>{dateCaption.textContent='กำหนดเอง: '+start.value+' ถึง '+end.value;});
 setMonth(0);
 async function loadEmployees(){
  reload.disabled=true;notice.textContent='กำลังโหลดพนักงาน…';
  try{
   const r=await fetch('/api/hr/roster?stationId='+encodeURIComponent(stationId),{
    cache:'no-store',headers:{authorization:'Bearer '+token}});
   if(!r.ok)throw new Error('not_authorized');
   const roster=(await r.json()).roster;
   const selected=employee.value;employee.replaceChildren();
   for(const e of roster?.employees||[]){
    const opt=document.createElement('option');opt.value=e.id;
    opt.textContent=e.name+' ('+e.code+')';employee.append(opt);
   }
   if([...employee.options].some(o=>o.value===selected))employee.value=selected;
   submit.disabled=employee.options.length===0;
   notice.textContent=employee.options.length?'เลือกพนักงานและกดตรวจสรุปได้เลย':'ยังไม่มีพนักงานที่ดูได้';
  }catch{submit.disabled=true;notice.textContent='โหลดรายชื่อไม่ได้ กรุณาตรวจสิทธิ์การจัดการพนักงาน';}
  finally{reload.disabled=false;}
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();resultCard.hidden=true;
  if(!employee.value||!start.value||!end.value||end.value<=start.value){
   notice.textContent='โปรดเลือกพนักงานและช่วงวันที่สิ้นสุดหลังวันเริ่มต้น';return;
  }
  submit.disabled=true;notice.textContent='กำลังตรวจสอบเวลาและการอนุมัติ…';
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
   resultText.textContent='เวลาทำงาน '+result.workedMinutes+' นาที · พัก '+
    result.breakMinutes+' นาที · '+result.shifts+' กะ';
   resultCard.hidden=false;
   notice.textContent='ตรวจข้อมูลเวลาเสร็จแล้ว · ยังต้องตรวจรายการเงินเดือนก่อนจ่ายจริง';
  }catch{
   notice.textContent='ยังคำนวณไม่ได้: มีเวลาที่รออนุมัติ ปฏิเสธ หลักฐานไม่ครบ หรือกะเข้าออกไม่สมบูรณ์';
  }finally{submit.disabled=false;}
 });
 reload.addEventListener('click',loadEmployees);
 loadEmployees().catch(()=>{notice.textContent='โหลดข้อมูลไม่ได้';});
}
