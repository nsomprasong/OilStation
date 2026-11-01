import QRCode from 'qrcode';
import {planAdvanceInstallments} from '../domain/advance-installments.mjs';
const money=value=>{
 const s=String(value||'').trim();
 if(!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(s))throw new Error('กรอกจำนวนเงินเป็นบาทและสตางค์ให้ถูกต้อง');
 const [baht,cents='']=s.split('.');
 const amount=Number(baht)*100+Number(cents.padEnd(2,'0'));
 if(!Number.isSafeInteger(amount)||amount<1)throw new Error('ยอดต้องมากกว่า 0');
 return String(amount);
};
const fmt=value=>(Number(value)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
function el(tag,label,cls){
 const node=document.createElement(tag);
 if(label!==undefined)node.textContent=label;
 if(cls)node.className=cls;
 return node;
}
function choose(label,options){
 const field=el('label',label,'field');
 const select=document.createElement('select');
 for(const [value,name] of options){const o=el('option',name);o.value=value;select.append(o);}
 field.append(select);return {field,select};
}
function field(label,type,placeholder=''){
 const wrap=el('label',label,'field'),input=document.createElement('input');
 input.type=type;input.placeholder=placeholder;wrap.append(input);return {wrap,input};
}
export async function mountHrPayeeAdvance({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const request=async(path,{method='GET',body=null}={})=>{
  const r=await fetch(path,{method,cache:'no-store',headers:{
   authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw new Error(r.status===404||r.status===503?
   'ยังไม่เปิดบริการ HR สำหรับสถานีนี้':'ตรวจสอบรายการไม่ได้ (HTTP '+r.status+')');
  return r.json();
 };
 const heading=el('h3','บัญชีรับเงินและเงินเบิก · 3 ขั้นตอน');
 const hint=el('p','บันทึกข้อมูล → ผู้จัดการอีกคนยืนยันบัญชี → สร้าง QR หรือรายการโอนเอง · QR ไม่ใช่หลักฐานว่าจ่ายแล้ว','hint');
 const employee=choose('1 · พนักงาน',[]);employee.select.required=true;
 const payeeForm=el('form',undefined,'coupon-form');
 const type=choose('2 · ช่องทางรับเงิน',[['promptpay_phone','PromptPay เบอร์มือถือ'],['promptpay_national_id','PromptPay เลข 13 หลัก'],['bank_account','ไม่มี PromptPay — โอนเข้าบัญชีธนาคาร']]);
 const reference=field('เลขพร้อมเพย์ / เลขบัญชี','text','กรอกเลขบัญชีที่พนักงานแจ้ง');
 reference.input.required=true;reference.input.autocomplete='off';reference.input.maxLength=30;
 const bank=field('รหัสธนาคาร (เช่น KBANK, SCB)','text','KBANK');
 bank.input.maxLength=10;bank.input.pattern='[A-Z0-9]{2,10}';
 bank.wrap.hidden=true;
 const save=el('button','บันทึกบัญชีเพื่อรอตรวจสอบ','button primary');save.type='submit';
 payeeForm.append(type.field,reference.wrap,bank.wrap,save);
 type.select.addEventListener('change',()=>{
  bank.wrap.hidden=type.select.value!=='bank_account';
  bank.input.required=type.select.value==='bank_account';
 });
 const payeeList=el('div',undefined,'module-list');
 const transfer=el('div',undefined,'module-item');transfer.hidden=true;
 const advanceForm=el('form',undefined,'coupon-form');
 const amount=field('ยอดเงินเบิก (บาท)','text','3000.00');
 amount.input.required=true;amount.input.inputMode='decimal';
 const count=field('จำนวนงวดหัก (1–24)','number','3');
 count.input.min='1';count.input.max='24';count.input.step='1';count.input.value='3';
 const first=field('เริ่มหักงวดวันที่','date');
 const preview=el('div',undefined,'module-list');
 const submit=el('button','ส่งคำขอเบิกเงิน','button primary');submit.type='submit';
 advanceForm.append(amount.wrap,count.wrap,first.wrap,preview,submit);
 const advanceList=el('div',undefined,'module-list');
 const status=el('p',undefined,'notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const tabPayee=el('details');tabPayee.open=true;tabPayee.append(el('summary','ช่องทางรับเงิน — PromptPay / ธนาคาร'),payeeForm,payeeList,transfer);
 const tabAdvance=el('details');tabAdvance.append(el('summary','เงินเบิกล่วงหน้า — เลือกงวดหัก'),advanceForm,advanceList);
 target.append(heading,hint,employee.field,tabPayee,tabAdvance,status);
 const say=(value,wrong=false)=>{status.textContent=value;status.dataset.tone=wrong?'error':'neutral';};
 const qs=()=>'?employeeId='+encodeURIComponent(employee.select.value);
 let roster=[],frequency='monthly';
 const refresh=async()=>{
  transfer.hidden=true;payeeList.replaceChildren();advanceList.replaceChildren();
  if(!employee.select.value)return;
  const selected=roster.find(e=>e.id===employee.select.value);frequency=selected?.payrollFrequency||'monthly';
  const [payees,advances,confirmations]=await Promise.all([
   request('/api/hr/payees'+qs()),request('/api/hr/advances'+qs()),
   request('/api/hr/advances/manual-confirmations'+qs())]);
  for(const p of payees.items||[]){
   const row=el('div',undefined,'module-item');
   const label=el('strong',p.masked+' · '+(p.bankCode||p.type));
   const state=el('p',p.status==='approved'?'ยืนยันชื่อแล้ว: '+p.verifiedName:
    p.status==='pending'?'รอผู้จัดการอีกคนตรวจชื่อผู้รับ':'ไม่อนุมัติ','hint');
   row.append(label,state);
   if(p.status==='pending'){
    const name=field('ชื่อบัญชีที่ตรวจพบในแอปธนาคาร','text','ชื่อ-สกุลผู้รับ');
    name.input.maxLength=120;
    const approve=el('button','ยืนยันบัญชี','button secondary');approve.type='button';
    const reject=el('button','ไม่อนุมัติ','button secondary');reject.type='button';
    const decide=async(approved)=>{
     try{
      if(approved&&name.input.value.trim().length<2)throw new Error('ระบุชื่อที่ตรวจสอบแล้ว');
      await request('/api/hr/payees/review',{method:'POST',body:{
       methodId:p.id,approved,verifiedName:name.input.value.trim()}});
      say('บันทึกผลตรวจบัญชีแล้ว');await refresh();
     }catch(e){say(e.message,true);}
    };
    approve.addEventListener('click',()=>decide(true));
    reject.addEventListener('click',()=>decide(false));
    row.append(name.wrap,approve,reject);
   }else if(p.status==='approved'&&p.isPrimary===true){
    const instruction=el('button','สร้างรายการจ่าย / QR','button secondary');instruction.type='button';
    const transferAmount=field('ยอดที่ต้องการจ่าย (บาท)','text','500.00');
    transferAmount.input.inputMode='decimal';
    const show=el('button','แสดงคำสั่งโอน','button primary');show.type='button';
    transferAmount.wrap.hidden=true;show.hidden=true;
    instruction.addEventListener('click',()=>{
     transferAmount.wrap.hidden=false;show.hidden=false;
     transfer.hidden=true;
    });
    show.addEventListener('click',async()=>{
     try{
      const data=await request('/api/hr/payees/instruction',{method:'POST',
       body:{methodId:p.id,amountSatang:money(transferAmount.input.value)}});
      transfer.replaceChildren();
      const title=el('strong','รายการจ่าย '+fmt(data.amountSatang)+' บาท');
      const label=el('p',data.recipientName+' · ยังไม่ได้จ่ายเงิน','hint');
      transfer.append(title,label);
      if(data.kind==='promptpay'){
       const image=document.createElement('img');
       image.alt='PromptPay QR สำหรับโอนเงินเข้าพนักงาน';
       image.width=260;image.height=260;
       image.src=await QRCode.toDataURL(data.payload,{width:260,margin:3,errorCorrectionLevel:'M'});
       transfer.append(image,el('p','ก่อนโอน โปรดตรวจชื่อผู้รับในแอปธนาคารอีกครั้ง'));
      }else{
       transfer.append(el('p','ธนาคาร '+data.bankCode+' · บัญชี '+data.bankAccount),
        el('p','เปิดแอปธนาคารแล้วทำรายการโอนเอง'));
      }
      transfer.append(el('p','หลังโอนต้องตรวจผลโอนกับธนาคารและหลักฐานจริง · QR หรือสลิปไม่ใช่การยืนยันว่าจ่ายสำเร็จ','hint'));
      transfer.hidden=false;
      say('สร้างคำสั่งโอนสำหรับตรวจสอบแล้ว ยังไม่บันทึกว่าเงินถึงพนักงาน');
     }catch(e){say(e.message,true);}
    });
    row.append(instruction,transferAmount.wrap,show);
   }
   payeeList.append(row);
  }
  if(!(payees.items||[]).length)payeeList.append(el('p','ยังไม่มีช่องทางรับเงิน'));
  for(const a of advances.items||[]){
   const row=el('div',undefined,'module-item');
   row.append(el('strong','เบิก '+fmt(a.amountSatang)+' บาท · '+a.status),
    el('p','หัก '+a.installments+' งวด เริ่ม '+a.firstDeductionDate+' ('+a.frequency+')'));
   // An employee's chosen deduction date and each payment's status remain visible
   // after the request has been approved. This schedule never debits wages.
   if(Number.isSafeInteger(Number(a.amountSatang))&&Number.isSafeInteger(a.installments)
      &&a.firstDeductionDate&&a.frequency){
    const detail=el('details');
    detail.append(el('summary','ดูตารางหักรายงวด (ยังไม่หักเงินจริง)'));
    try{
     const schedule=planAdvanceInstallments({principalSatang:Number(a.amountSatang),
      installments:a.installments,firstDeductionDate:a.firstDeductionDate,
      frequency:a.frequency});
     for(const p of schedule)detail.append(el('p','งวด '+p.installment+' · '+p.date+
      ' · '+fmt(p.amountSatang)+' บาท · วางแผนเท่านั้น','hint'));
     if(a.status!=='paid'&&a.status!=='repaid')
      detail.append(el('p','ยังไม่ยืนยันการจ่ายเงินเบิก จึงไม่อนุญาตให้หักเงินเดือน','hint'));
    }catch{detail.append(el('p','ไม่สามารถแสดงตารางเดิมได้ กรุณาให้ฝ่ายบุคคลตรวจสอบ','hint'));}
    row.append(detail);
   }
   if(a.status==='requested'){
    const approve=el('button','อนุมัติคำขอ','button secondary');approve.type='button';
    const reject=el('button','ไม่อนุมัติ','button secondary');reject.type='button';
    for(const [b,yes] of [[approve,true],[reject,false]])b.addEventListener('click',async()=>{
     try{await request('/api/hr/advances/review',{method:'POST',
      body:{advanceId:a.id,approved:yes}});
      say('บันทึกผลคำขอแล้ว ยังไม่มีการจ่ายหรือหักเงินจริง');await refresh();
     }catch(e){say(e.message,true);}
    });
    row.append(approve,reject);
   }
   const evidence=(confirmations.items||[]).find(c=>c.advanceId===a.id&&c.status==='pending');
   const primary=(payees.items||[]).find(p=>p.status==='approved'&&p.isPrimary===true);
   if(a.status==='approved'&&evidence){
    const review=el('details');review.append(el('summary','ตรวจหลักฐานโอนเงินเบิก · รอคนละบัญชี'));
    review.append(el('p','อ้างอิงธุรกรรม '+evidence.maskedBankReference+
     ' · ต้องตรวจรายการโอนกับธนาคารด้วยตนเอง','hint'));
    const approve=el('button','ยืนยันหลังตรวจรายการธนาคารแล้ว','button secondary');
    approve.type='button';
    const reject=el('button','หลักฐานไม่ผ่าน','button secondary');reject.type='button';
    for(const [button,verified] of [[approve,true],[reject,false]])
     button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
       const result=await request('/api/hr/advances/manual-confirmation/review',{
        method:'POST',body:{claimId:evidence.id,verified}});
       say(verified?'บันทึกการตรวจโอนภายนอกแล้ว · ยังไม่หักเงินเดือน':
        'ปฏิเสธหลักฐานแล้ว · ยังไม่มีการจ่ายเงินเบิกในระบบ');
       if(result.claim?.deducted===true)throw new Error('ระบบหักเงินโดยไม่ได้อนุญาต');
       await refresh();
      }catch(e){say(e.message,true);}finally{button.disabled=false;}
     });
    review.append(approve,reject);
    row.append(review);
   }else if(a.status==='approved'&&primary){
    const claim=el('details');claim.append(el('summary','แจ้งโอนเงินเบิกจากแอปธนาคารแล้ว'));
    claim.append(el('p','เฉพาะผู้ที่โอนเงินจริงแล้วเท่านั้น ระบบไม่ได้สั่งโอนเงิน และจะรอคนละบัญชียืนยัน','hint'));
    const form=el('form',undefined,'coupon-form');
    const bankRef=field('เลขอ้างอิงจากรายการโอนธนาคารจริง','text','เลขอ้างอิง 8–80 ตัว');
    bankRef.input.required=true;bankRef.input.minLength=8;bankRef.input.maxLength=80;
    bankRef.input.pattern='[A-Z0-9-]{8,80}';bankRef.input.autocomplete='off';
    const submitClaim=el('button','ส่งให้ตรวจยอดโอน','button secondary');submitClaim.type='submit';
    form.append(bankRef.wrap,submitClaim);claim.append(form);
    form.addEventListener('submit',async event=>{
     event.preventDefault();submitClaim.disabled=true;
     try{
      await request('/api/hr/advances/manual-confirmation/submit',{
       method:'POST',body:{advanceId:a.id,methodId:primary.id,
        bankReference:bankRef.input.value.trim().toUpperCase()}});
      bankRef.input.value='';
      say('รับเลขอ้างอิงแล้ว · ยังไม่ถือว่าจ่ายจนกว่าคนละบัญชีตรวจธนาคาร');
      await refresh();
     }catch(e){say(e.message,true);}finally{submitClaim.disabled=false;}
    });
    row.append(claim);
   }else if(a.status==='approved'&&!primary){
    row.append(el('p','ต้องอนุมัติบัญชีรับเงินหลักก่อนบันทึกการโอน','hint'));
   }else if(a.status==='paid'){
    row.append(el('p','ธนาคารได้รับการยืนยันโดยผู้ตรวจ 2 คนแล้ว · ยังต้องผ่านงวด Payroll ก่อนหัก','hint'));
   }
   advanceList.append(row);
  }
  if(!(advances.items||[]).length)advanceList.append(el('p','ยังไม่มีคำขอเงินเบิก'));
 };
 async function loadRoster(){
  try{
   const r=await request('/api/hr/roster?stationId='+encodeURIComponent(stationId));
   roster=r.roster?.employees||[];
   const previous=employee.select.value;employee.select.replaceChildren();
   for(const e of roster){const opt=el('option',e.name+' ('+e.code+')');
    opt.value=e.id;employee.select.append(opt);}
   if(roster.some(e=>e.id===previous))employee.select.value=previous;
   if(!employee.select.value){say('ยังไม่มีพนักงานที่จะบันทึกบัญชีรับเงิน');return;}
   await refresh();
  }catch(e){say(e.message,true);}
 }
 employee.select.addEventListener('change',()=>refresh().catch(e=>say(e.message,true)));
 payeeForm.addEventListener('submit',async event=>{
  event.preventDefault();save.disabled=true;
  try{await request('/api/hr/payees/register',{method:'POST',body:{
   employeeId:employee.select.value,type:type.select.value,
   reference:reference.input.value,bankCode:type.select.value==='bank_account'?bank.input.value.trim().toUpperCase():null}});
   reference.input.value='';say('บันทึกข้อมูลในที่เก็บเข้ารหัสแล้ว รอผู้จัดการอีกคนยืนยันผู้รับ');
   await refresh();
  }catch(e){say(e.message,true);}finally{save.disabled=false;}
 });
 function updatePlan(){
  preview.replaceChildren();
  try{
   if(!amount.input.value||!first.input.value)return;
   const plan=planAdvanceInstallments({
    principalSatang:Number(money(amount.input.value)),
    installments:Number(count.input.value),
    firstDeductionDate:first.input.value,frequency});
   for(const p of plan)preview.append(el('p','งวด '+p.installment+' · '+p.date+
    ' · '+fmt(p.amountSatang)+' บาท'));
   preview.append(el('p','ตารางจำลองเท่านั้น จะหักจริงหลังจ่ายเงินเบิกและตรวจสิทธิ์ตามกฎหมาย','hint'));
  }catch(e){preview.append(el('p',e.message,'hint'));}
 }
 for(const item of [amount.input,count.input,first.input])item.addEventListener('change',updatePlan);
 advanceForm.addEventListener('submit',async event=>{
  event.preventDefault();submit.disabled=true;
  try{
   updatePlan();
   await request('/api/hr/advances/request',{method:'POST',body:{
    employeeId:employee.select.value,amountSatang:money(amount.input.value),
    installments:Number(count.input.value),firstDeductionDate:first.input.value}});
   say('ส่งคำขอเบิกแล้ว · ไม่เกิดการโอนหรือหักเงินจริงจนกว่าจะแยกอนุมัติและจ่าย');
   await refresh();
  }catch(e){say(e.message,true);}finally{submit.disabled=false;}
 });
 await loadRoster();
}
