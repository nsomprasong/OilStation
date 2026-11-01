/** Human-reviewed payroll draft. No transfer, deduction posting or bank export. */
const element=(tag,value,cls)=>{
 const x=document.createElement(tag);if(value!==undefined)x.textContent=value;
 if(cls)x.className=cls;return x;
};
const amount=(value,allowNegative=false)=>{
 const m=/^(-?)(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
 if(!m||(!allowNegative&&m[1]))throw new Error('จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง');
 const n=BigInt(m[2])*100n+BigInt((m[3]||'').padEnd(2,'0'));
 return ((m[1]? -n:n)).toString();
};
const field=(text,placeholder)=>{
 const label=element('label',text,'field'),input=element('input');
 input.type='text';input.inputMode='decimal';input.required=true;
 if(placeholder)input.placeholder=placeholder;input.autocomplete='off';
 label.append(input);return{label,input};
};
export function mountHrPayrollDraft({target,token,stationId,getContext}){
 if(!target)return;
 target.replaceChildren();
 const hint=element('p','เตรียมยอดเงินเดือนจากหลักฐานจริงที่ฝ่ายบุคคลและบัญชีตรวจแล้ว · ยังไม่จ่ายเงิน ไม่ส่งธนาคาร และไม่หักเงินเบิกอัตโนมัติ','hint');
 const form=element('form',undefined,'coupon-form');
 const fields=[
  ['baseSatang','ฐานค่าจ้าง (บาท)'],['otSatang','ค่า OT ที่ตรวจแล้ว (บาท)'],
  ['otherEarningsSatang','รายรับเพิ่มเติม (บาท)'],['taxSatang','ภาษีที่ฝ่ายบัญชีตรวจแล้ว (บาท)'],
  ['socialSecuritySatang','ประกันสังคมที่ตรวจแล้ว (บาท)'],
  ['otherDeductionsSatang','รายการหักอื่นที่มีเอกสาร (บาท)'],
  ['adjustmentSatang','ปรับปรุง (+/- บาท)'],
 ].map(([key,label])=>({key,...field(label,'กรอกยอด เช่น 0.00')}));
 const doc=element('label','หลักฐานการคำนวณ / ระเบียบค่าจ้างและภาษี (25–1000 ตัวอักษร)','field');
 const basis=element('textarea');basis.required=true;basis.minLength=25;basis.maxLength=1000;
 doc.append(basis);
 const submit=element('button','สร้างร่างเงินเดือนส่งให้ฝ่ายบัญชีตรวจ','button primary');
 submit.type='submit';
 form.append(...fields.map(f=>f.label),doc,submit);
 const list=element('section',undefined,'module-list');
 const reload=element('button','รีเฟรชรายการร่างเงินเดือน','button secondary');
 reload.type='button';
 const message=element('p',undefined,'notice');message.setAttribute('role','status');
 target.append(hint,form,reload,list,message);
 const say=(x,bad=false)=>{message.textContent=x;message.dataset.tone=bad?'error':'neutral';};
 const request=async(path,{method='GET',body}={})=>{
  const response=await fetch(path,{method,cache:'no-store',headers:{
   authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'รายการไม่พร้อม (HTTP '+response.status+')');
  return data;
 };
 async function refresh(){
  const {drafts}=await request('/api/hr/payroll/drafts?stationId='+encodeURIComponent(stationId));
  list.replaceChildren();
  if(!drafts.length)list.append(element('p','ยังไม่มีร่างเงินเดือน','hint'));
  for(const run of drafts){
   const box=element('article',undefined,'module-item');
   box.append(element('strong',run.periodStart+' ถึง '+run.periodEndExclusive+' · '+run.status),
    element('p','พนักงาน '+run.lines.length+' คน · ยังไม่ได้อนุมัติจ่ายเงิน','hint'));
   for(const line of run.lines){
    const amount=Number(line.netSatang)/100;
    box.append(element('p','ยอดสุทธิรอตรวจ '+amount.toLocaleString('th-TH',{
     minimumFractionDigits:2,maximumFractionDigits:2})+' บาท · พนักงาน '+line.employeeId,'hint'));
   }
   if(run.status==='draft'&&!run.submittedBySelf){
    const approval=element('details'),summary=element('summary','ตรวจร่างโดยผู้อนุมัติคนละบัญชี');
    const reviewBasis=element('textarea');reviewBasis.required=true;
    reviewBasis.minLength=30;reviewBasis.maxLength=1000;
    reviewBasis.placeholder='แนบเหตุผลตรวจยอด ภาษี/ประกันสังคม เอกสารเวลา และค่า OT (อย่างน้อย 30 ตัวอักษร)';
    approval.append(summary,reviewBasis);
    for(const [yes,label] of [[true,'ยืนยันตรวจร่าง'],[false,'ส่งกลับแก้ไข']]){
     const button=element('button',label,'button secondary');button.type='button';
     button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
       const r=await request('/api/hr/payroll/drafts/review',{method:'POST',body:{
        runId:run.id,approved:yes,legalBasis:reviewBasis.value}});
       if(r.posted!==false||r.paid!==false||r.payable!==false)
        throw new Error('รายการตรวจผิดรูปแบบ');
       say(yes?'ตรวจร่างแล้ว · ยังไม่อนุมัติการโอนเงินจริง':'ส่งกลับแก้ไข · ไม่จ่ายเงิน');
       await refresh();
      }catch(e){say(e.message,true);}finally{button.disabled=false;}
     });
     approval.append(button);
    }
    box.append(approval);
   }
   list.append(box);
  }
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();submit.disabled=true;
  try{
   const {employeeId,startDate,endDate}=getContext();
   if(!employeeId||!startDate||!endDate||endDate<=startDate)
    throw new Error('เลือกพนักงานและงวดก่อนสร้างร่าง');
   const data=Object.fromEntries(fields.map(f=>[
    f.key,amount(f.input.value,f.key==='adjustmentSatang')]));
   const result=await request('/api/hr/payroll/drafts/line',{method:'POST',body:{
    employeeId,startDate,endDate,...data,basis:basis.value.trim()}});
   if(result.payable!==false||result.paid!==false||result.posted!==false)
    throw new Error('รายการร่างไม่ปลอดภัย');
   say('สร้างร่างเพื่อทบทวนแล้ว · ยังไม่มีรายการจ่าย/หักจริง');
   await refresh();
  }catch(e){say(e.message,true);}finally{submit.disabled=false;}
 });
 reload.addEventListener('click',()=>refresh().catch(e=>say(e.message,true)));
 refresh().catch(e=>say(e.message,true));
}