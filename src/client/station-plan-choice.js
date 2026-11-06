/** Invited station owner's plan choice and read-only replacement preview. No charge is initiated. */
import {previewSubscriptionPlanChange} from '../domain/subscription-plan-change-preview.mjs';
const baht=v=>{
 if(!/^(?:0|[1-9]\d{0,15})$/.test(String(v??'')))return '—';
 const n=BigInt(v);return (n/100n).toLocaleString('th-TH')+'.'+(n%100n).toString().padStart(2,'0')+' บาท';
};
const node=(type,text)=>{const el=document.createElement(type);if(text!==undefined)el.textContent=text;return el;};
export function mountStationPlanChoice({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const section=node('section');section.className='owner-plan-onboarding';
 const caption=node('p','คุณได้รับสิทธิ์เจ้าของปั๊มแล้ว เลือกแพ็กเกจและวิธีชำระเงินได้ที่นี่');
 const steps=node('p','ขั้นตอนที่ 3 — เลือกแพ็กเกจและวิธีชำระเงิน');steps.className='owner-plan-step';
 const station=node('h3','กำลังโหลดข้อมูลปั๊ม…');
 const subscriptionNotice=node('p');subscriptionNotice.className='owner-plan-current-term';
 const plans=node('div');plans.className='owner-plan-list';
 const payment=node('fieldset');payment.className='owner-payment-methods';
 const legend=node('legend','เลือกช่องทางชำระเงิน');payment.append(legend);
 const choices=[['card','บัตรเครดิต / เดบิต'],['promptpay','PromptPay (ส่วนลด 2%)']];
 for(const [code,title] of choices){
  const label=node('label');const input=node('input');input.type='radio';
  input.name='owner-payment-method';input.value=code;input.checked=code==='card';
  label.append(input,document.createTextNode(' '+title));payment.append(label);
 }
 const quote=node('div');quote.className='owner-plan-quote';
 const switchPreview=node('section');switchPreview.className='owner-plan-change-preview';
 const switchHeading=node('h4','ตัวอย่างการเปลี่ยนแพ็กเกจ (ยังไม่บันทึก)');
 const switchLabel=node('label','วันเริ่มแพ็กเกจใหม่ (ไม่ระบุ = สิ้นรอบปัจจุบัน)');
 const switchDate=node('input');switchDate.type='date';switchDate.setAttribute('aria-label','วันเริ่มแพ็กเกจใหม่');
 switchLabel.append(switchDate);
 const switchResult=node('p');switchResult.setAttribute('role','note');
 const switchWarning=node('p','เป็นการคำนวณตัวอย่างเท่านั้น ยังไม่บันทึกคำขอ ไม่เปลี่ยนสิทธิ์ และไม่ตัดเงิน');
 switchWarning.className='hint';
 switchPreview.append(switchHeading,switchLabel,switchResult,switchWarning);
 switchPreview.hidden=true;
 const button=node('button','ยืนยันแพ็กเกจและวิธีชำระเงิน');button.className='button primary';button.type='button';
 const status=node('p');status.setAttribute('role','status');status.className='owner-plan-status';
 const info=node('p','ระบบบันทึกตัวเลือกไว้ก่อน โดยยังไม่ตัดเงินหรือเริ่ม Subscription จนกว่าจะมีการยืนยันการชำระเงิน');info.className='hint';
 section.append(steps,station,caption,subscriptionNotice,plans,payment,quote,switchPreview,button,status,info);target.append(section);
 let rows=[],current=null,activeSubscription=false,currentTerm=null;
 const day=value=>{
  const date=new Date(value);
  return Number.isFinite(date.valueOf())?
   new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date):'—';
 };
 const selectedMethod=()=>payment.querySelector('input:checked')?.value||'card';
 const viewSchedule=()=>{
  switchPreview.hidden=!activeSubscription;
  if(!activeSubscription||!currentTerm)return;
  const chosen=rows.find(row=>row.id===current);
  if(!chosen||currentTerm.planId===current){
   switchResult.textContent='เลือกแพ็กเกจใหม่ที่ต่างจากแพ็กเกจปัจจุบันเพื่อดูวันเริ่มตัวอย่าง';return;
  }
  if(switchDate.value&&(!Number.isInteger(currentTerm.anchorDay)||
     currentTerm.anchorDay<1||currentTerm.anchorDay>31)){
   switchResult.textContent='ยังไม่สามารถคำนวณวันเริ่มอนาคตได้ เพราะไม่มีข้อมูลวันยึดรอบต่ออายุจากเซิร์ฟเวอร์ กรุณาดูตัวอย่างวันสิ้นรอบปัจจุบันแทน';
   return;
  }
  try{
   const end=new Date(currentTerm.periodEnd);
   const sample=previewSubscriptionPlanChange({
    currentPlanId:currentTerm.planId,nextPlanId:chosen.id,
    currentBillingFrequency:currentTerm.frequency,nextBillingFrequency:chosen.frequency,
    currentPeriodEndUtc:currentTerm.periodEnd,
    requestedStartOn:switchDate.value||null,
    anchorDay:currentTerm.anchorDay||end.getUTCDate(),
    mode:switchDate.value?'future_renewal':'next_renewal',
    nowUtc:new Date().toISOString(),
   });
   switchResult.textContent='แพ็กเกจเดิมสิ้นสุด '+day(sample.oldPlanUntilExclusiveUtc)+
    ' · แพ็กเกจใหม่เริ่ม '+day(sample.newPlanEffectiveAtUtc)+
    ' · ต่ออายุแพ็กเกจเดิมระหว่างรอ '+sample.oldPlanRenewalsBeforeSwitch+' รอบ'+
    ' (เวลาไทย; ยังไม่ใช่การยืนยัน)';
  }catch{
   switchResult.textContent='วันเริ่มที่เลือกใช้ไม่ได้ ต้องตรงกับวันต่ออายุของแพ็กเกจเดิม และไม่ย้อนหลัง';
  }
 };
 const viewPrice=()=>{
  const chosen=rows.find(row=>row.id===current);
  if(!chosen){quote.textContent='กรุณาเลือกแพ็กเกจ';button.disabled=true;viewSchedule();return;}
  const q=chosen[selectedMethod()];
  quote.replaceChildren();
  if(!q){quote.textContent='ยังไม่มีราคาสำหรับแพ็กเกจนี้';button.disabled=true;viewSchedule();return;}
  button.disabled=activeSubscription;
  const details=node('div');
  details.append(node('p','ราคาบริการ '+baht(q.subtotalSatang)),
   node('p','ส่วนลด '+baht(q.discountSatang)),
   node('p','VAT '+baht(q.taxSatang)));
  const total=node('strong','ยอดตามแพ็กเกจ '+baht(q.totalSatang));
  quote.append(details,total);
  viewSchedule();
 };
 const request=async(path,body)=>{
  const init={cache:'no-store',headers:{authorization:'Bearer '+token}};
  if(body){init.method='POST';init.headers['content-type']='application/json';init.body=JSON.stringify(body);}
  const res=await fetch(path,init);
  if(!res.ok)throw new Error('request_unavailable');
  return (await res.json()).result;
 };
 async function load(){
  button.disabled=true;status.textContent='กำลังโหลดแพ็กเกจ…';
  try{
   const result=await request('/api/station/billing/options?stationId='+encodeURIComponent(stationId));
   station.textContent=result.stationName||'ปั๊มน้ำมันของคุณ';
   rows=result.plans||[];
   const prior=result.selected;
   currentTerm=result.subscription||null;
   activeSubscription=!!currentTerm&&['trialing','active','grace','overdue'].includes(currentTerm.status);
   if(activeSubscription){
    subscriptionNotice.textContent='แพ็กเกจปัจจุบัน: '+(currentTerm.planName||'—')+
      ' · สถานะ '+currentTerm.status+' · เริ่ม '+day(currentTerm.startsAt)+
      ' · สิ้นสุดรอบ '+day(currentTerm.periodEnd)+
      ' (เวลาไทย)';
   }else subscriptionNotice.textContent='ยังไม่มี Subscription ที่เปิดใช้งาน';
   current=currentTerm?.planId||prior?.planId||rows[0]?.id||null;
   if(prior?.paymentMethod){
    const matching=payment.querySelector('input[value="'+prior.paymentMethod+'"]');
    if(matching)matching.checked=true;
   }
   plans.replaceChildren();
   if(!rows.length){plans.append(node('p','ยังไม่มีแพ็กเกจที่พร้อมใช้ กรุณาให้ผู้ดูแลตั้งค่า VAT และสร้างแพ็กเกจก่อน'));}
   for(const p of rows){
    const item=node('label');item.className='owner-plan-card';
    const radio=node('input');radio.type='radio';radio.name='owner-plan';radio.value=p.id;
    radio.checked=p.id===current;
    const detail=node('span');detail.className='owner-plan-description';
    detail.append(node('strong',p.name),
      node('small',p.frequency==='yearly'?'รอบชำระรายปี':'รอบชำระรายเดือน'));
    item.append(radio,detail);
    radio.addEventListener('change',()=>{current=p.id;viewPrice();});
    plans.append(item);
   }
   viewPrice();
   status.textContent=activeSubscription?
    'การเปลี่ยนแพ็กเกจต้องกำหนดวันเริ่มใหม่และยืนยันการชำระเงินก่อน ระบบยังไม่เปิดการสลับแพ็กเกจอัตโนมัติ':
    prior?'บันทึกแพ็กเกจไว้แล้ว · สถานะรอชำระเงิน (ยังไม่ถูกเรียกเก็บเงิน)':'';
  }catch{status.textContent='โหลดแพ็กเกจไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าของปั๊มหรือติดต่อผู้ดูแล';button.disabled=true;}
 }
 payment.addEventListener('change',viewPrice);
 switchDate.addEventListener('change',viewSchedule);
 button.addEventListener('click',async()=>{
  if(!current||activeSubscription)return;
  button.disabled=true;status.textContent='กำลังบันทึกตัวเลือก…';
  try{
   const data=await request('/api/station/billing/select',{
    stationId,planId:current,paymentMethod:selectedMethod(),
   });
   status.textContent=data?.status==='pending_payment'?
    'บันทึกเรียบร้อย · รอชำระเงิน '+baht(data.amountSatang)+' (ยังไม่ได้ตัดเงิน)':
    'บันทึกสำเร็จ';
  }catch{status.textContent='บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';}
  finally{button.disabled=activeSubscription;}
 });
 load().catch(()=>{status.textContent='โหลดข้อมูลไม่ได้';});
}
