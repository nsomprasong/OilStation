/** Station payroll & leave policy. No defaults for statutory entitlements. */
const el=(tag,label,cls)=>{
 const x=document.createElement(tag);if(label!==undefined)x.textContent=label;
 if(cls)x.className=cls;return x;
};
const makeNumber=(caption,min,max,placeholder)=>{
 const wrap=el('label',caption,'field'),input=el('input');
 input.type='number';input.required=true;input.min=String(min);input.max=String(max);
 input.step='1';if(placeholder)input.placeholder=placeholder;wrap.append(input);
 return {wrap,input};
};
const makeCheck=caption=>{
 const wrap=el('label',undefined,'field'),input=el('input');input.type='checkbox';
 wrap.append(input,document.createTextNode(' '+caption));return{wrap,input};
};
export function mountHrPayrollPolicy({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const hint=el('p','กำหนดนโยบายตามเอกสารของสถานีเอง แล้วให้เจ้าของหรือฝ่ายการเงินอีกบัญชีตรวจสอบ · ไม่ใช้ค่าอัตรากฎหมายสมมติ','hint');
 const list=el('div',undefined,'module-list');
 const form=el('form',undefined,'coupon-form');
 const effective=el('label','วันที่เริ่มใช้','field'),date=el('input');
 date.type='date';date.required=true;effective.append(date);
 const divisor=makeNumber('จำนวนวันหารเงินเดือนรายเดือน',1,31,'จำนวนวันตามข้อตกลง');
 const minutes=makeNumber('นาทีทำงานปกติต่อวัน',240,720);
 const overtime=makeNumber('อัตรา OT ×10000 (เช่น 15000 = 1.5 เท่า)',10000,40000);
 const annual=makeNumber('สิทธิ์ลาพักร้อนต่อปี (วัน)',0,366);
 const sick=makeNumber('สิทธิ์ลาป่วยต่อปี (วัน)',0,366);
 const personal=makeNumber('สิทธิ์ลากิจต่อปี (วัน)',0,366);
 const paidAnnual=makeCheck('ลาพักร้อนที่อนุมัติได้รับค่าจ้าง');
 const paidSick=makeCheck('ลาป่วยที่อนุมัติได้รับค่าจ้าง');
 const paidPersonal=makeCheck('ลากิจที่อนุมัติได้รับค่าจ้าง');
 const legal=el('label','ระบุหลักฐานนโยบายและผู้ตรวจข้อกฎหมาย (20–1000 ตัวอักษร)','field');
 const basis=el('textarea');basis.minLength=20;basis.maxLength=1000;basis.required=true;
 legal.append(basis);
 const send=el('button','ส่งนโยบายให้ผู้มีสิทธิ์อีกคนตรวจ','button primary');
 send.type='submit';
 form.append(effective,divisor.wrap,minutes.wrap,overtime.wrap,
  annual.wrap,sick.wrap,personal.wrap,paidAnnual.wrap,paidSick.wrap,paidPersonal.wrap,
  legal,send);
 const notice=el('p',undefined,'notice');notice.setAttribute('role','status');
 target.append(hint,list,form,notice);
 const say=(s,bad=false)=>{notice.textContent=s;notice.dataset.tone=bad?'error':'neutral';};
 const api=async(path,{method='GET',body}={})=>{
  const r=await fetch(path,{method,cache:'no-store',headers:{
   authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'เรียกข้อมูลไม่ได้ (HTTP '+r.status+')');
  return data;
 };
 async function refresh(){
  const {items}=await api('/api/hr/payroll/policies?stationId='+encodeURIComponent(stationId));
  list.replaceChildren();
  if(!items.length)list.append(el('p','ยังไม่มีนโยบายอนุมัติ · การปิดงวดเงินเดือนถูกบล็อก','hint'));
  for(const p of items){
   const row=el('article',undefined,'module-item');
   row.append(el('strong',p.effectiveFrom+' · '+p.status),
    el('p','หารรายเดือน '+p.monthlyDivisorDays+' วัน · OT '+p.overtimeRateBps/10000+' เท่า · พักร้อน '+p.annualLeaveDays+' วัน','hint'),
    el('p','นโยบายค่าจ้าง/การลาเท่านั้น ภาษีและประกันสังคมยังต้องตรวจแยก','hint'));
   if(p.status==='pending'&&!p.submittedBySelf){
    const approve=el('button','ยืนยันนโยบายหลังตรวจเอกสาร','button secondary'),
     reject=el('button','ไม่อนุมัตินโยบาย','button secondary');
    for(const [button,value] of [[approve,true],[reject,false]]){
     button.type='button';
     button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
       const r=await api('/api/hr/payroll/policies/review',{method:'POST',
        body:{policyId:p.id,approved:value}});
       if(r.payable!==false)throw new Error('ไม่อนุญาตให้สั่งจ่าย');
       say(value?'อนุมัตินโยบายแล้ว แต่ยังไม่อนุมัติเงินเดือน':'ปฏิเสธนโยบายแล้ว');
       await refresh();
      }catch(e){say(e.message,true);}finally{button.disabled=false;}
     });
    }
    row.append(approve,reject);
   }
   list.append(row);
  }
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();send.disabled=true;
  try{
   const body={
    stationId,effectiveFrom:date.value,
    monthlyDivisorDays:Number(divisor.input.value),normalDayMinutes:Number(minutes.input.value),
    overtimeRateBps:Number(overtime.input.value),
    annualLeaveDays:Number(annual.input.value),sickLeaveDays:Number(sick.input.value),
    personalLeaveDays:Number(personal.input.value),
    paidAnnual:paidAnnual.input.checked,paidSick:paidSick.input.checked,
    paidPersonal:paidPersonal.input.checked,policyBasis:basis.value.trim(),
   };
   const result=await api('/api/hr/payroll/policies/propose',{method:'POST',body});
   if(result.payable!==false)throw new Error('ไม่อนุญาตให้สั่งจ่าย');
   say('ส่งนโยบายแล้ว · ต้องให้ผู้มีสิทธิ์อีกบัญชีตรวจ ไม่จ่ายเงินอัตโนมัติ');
   basis.value='';await refresh();
  }catch(e){say(e.message,true);}finally{send.disabled=false;}
 });
 refresh().catch(e=>say(e.message,true));
}