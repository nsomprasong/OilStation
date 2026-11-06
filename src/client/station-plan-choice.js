/** Invited station owner's plan choice and read-only replacement preview. No charge is initiated. */
import {previewSubscriptionPlanChange} from '../domain/subscription-plan-change-preview.mjs';
import {shapeSaasOwnerChangeHistory} from '../domain/subscription-change-history-display.mjs';
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
 const recentChanges=node('section');recentChanges.className='owner-plan-change-history';
 recentChanges.hidden=true;
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
 const moduleChoice=node('fieldset');moduleChoice.className='owner-plan-module-choice';
 moduleChoice.append(node('legend','โมดูลที่ต้องการในแพ็กเกจใหม่'));
 for(const [code,labelText] of [['qr_coupon','คูปอง QR'],['hr_payroll','HR และเงินเดือน']]){
  const label=node('label');const checkbox=node('input');checkbox.type='checkbox';
  checkbox.value=code;checkbox.name='next-module';
  label.append(checkbox,document.createTextNode(' '+labelText));moduleChoice.append(label);
 }
 const switchResult=node('p');switchResult.setAttribute('role','note');
 const switchPrice=node('p');switchPrice.setAttribute('role','status');
 const switchWarning=node('p','บันทึกคำขอได้เฉพาะวันสิ้นรอบปัจจุบัน และยังไม่ตัดเงินหรือเปลี่ยนสิทธิ์จนกว่าจะยืนยันการชำระเงิน');
 switchWarning.className='hint';
 const scheduleButton=node('button','บันทึกคำขอเปลี่ยนแพ็กเกจ');
 scheduleButton.className='button secondary';scheduleButton.type='button';scheduleButton.disabled=true;
 switchPreview.append(switchHeading,moduleChoice,switchLabel,switchResult,switchPrice,switchWarning,scheduleButton);
 switchPreview.hidden=true;
 const button=node('button','ยืนยันแพ็กเกจและวิธีชำระเงิน');button.className='button primary';button.type='button';
 const status=node('p');status.setAttribute('role','status');status.className='owner-plan-status';
 const info=node('p','ระบบบันทึกตัวเลือกไว้ก่อน โดยยังไม่ตัดเงินหรือเริ่ม Subscription จนกว่าจะมีการยืนยันการชำระเงิน');info.className='hint';
 section.append(steps,station,caption,subscriptionNotice,recentChanges,plans,payment,quote,switchPreview,button,status,info);target.append(section);
 let rows=[],current=null,activeSubscription=false,currentTerm=null,selectionSaved=false;
 let pendingChange=null,scheduleAt=null,scheduling=false,quoteSerial=0,quotedModulesKey=null;
 const day=value=>{
  const date=new Date(value);
  return Number.isFinite(date.valueOf())?
   new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(date):'—';
 };
 const selectedMethod=()=>payment.querySelector('input:checked')?.value||'card';
 const selectedModules=()=>[...moduleChoice.querySelectorAll('input:checked')].map(x=>x.value).sort();
 const viewSchedule=()=>{
  const sequence=++quoteSerial;
  scheduleAt=null;quotedModulesKey=null;switchPrice.textContent='';scheduleButton.disabled=true;
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
   if(sample.newPlanEffectiveAtUtc===new Date(currentTerm.periodEnd).toISOString()&&
      !pendingChange&&selectedModules().length){
    const targetModules=selectedModules();const key=targetModules.join(',');
    switchPrice.textContent='กำลังตรวจสอบราคาจริงจากเซิร์ฟเวอร์…';
    request('/api/station/billing/change/quote',{
     stationId,nextPlanId:chosen.id,paymentMethod:selectedMethod(),targetModules,
    }).then(data=>{
     if(sequence!==quoteSerial)return;
     if(new Date(data.effectiveAt).toISOString()!==sample.newPlanEffectiveAtUtc||
       (data.targetModules||[]).join(',')!==key)throw new Error('quote_changed');
     scheduleAt=sample.newPlanEffectiveAtUtc;quotedModulesKey=key;
     switchPrice.textContent='ราคาที่จะเรียกเก็บ '+baht(data.quote?.totalSatang)+
      ' · VAT '+baht(data.quote?.taxSatang)+' · ยังไม่ตัดเงิน';
     scheduleButton.disabled=scheduling;
    }).catch(()=>{
     if(sequence!==quoteSerial)return;
     switchPrice.textContent='ยังไม่มีใบเสนอราคาที่ใช้ได้กับโมดูลที่เลือก';
     scheduleButton.disabled=true;
    });
   }else if(!selectedModules().length){
    switchPrice.textContent='กรุณาเลือกอย่างน้อยหนึ่งโมดูล';
   }else if(sample.newPlanEffectiveAtUtc!==new Date(currentTerm.periodEnd).toISOString()){
    switchPrice.textContent='ขณะนี้บันทึกได้เฉพาะวันเริ่มที่ตรงกับสิ้นรอบปัจจุบัน';
   }
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
  button.disabled=activeSubscription||selectionSaved;
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
   const enabled=Array.isArray(result.enabledModules)?result.enabledModules:[];
   for(const item of moduleChoice.querySelectorAll('input[type=checkbox]'))
    item.checked=enabled.includes(item.value);
   recentChanges.replaceChildren();
   const changes=shapeSaasOwnerChangeHistory({
    rows:Array.isArray(result.recentChanges)?result.recentChanges:[],plans:rows,
   });
   recentChanges.hidden=changes.length===0;
   if(changes.length){
    recentChanges.append(node('h4','ประวัติคำขอเปลี่ยนแพ็กเกจ (อ่านอย่างเดียว)'));
    const list=node('ul');
    for(const change of changes){
     const entry=node('li');
     entry.append(node('span',change.name+
      ' · '+change.status+' · เริ่ม '+
      (change.effectiveAt?day(change.effectiveAt):'—')+' (เวลาไทย)'));
     if(change.status==='pending'&&change.paymentStatus==='unconfirmed'){
      const revoke=node('button','ยกเลิกคำขอ');revoke.type='button';
      revoke.className='button secondary';
      revoke.addEventListener('click',async()=>{
       revoke.disabled=true;
       try{await request('/api/station/billing/change/cancel',{stationId,changeId:change.id});
        await load();}catch{status.textContent='ยกเลิกคำขอไม่สำเร็จ';revoke.disabled=false;}
      });
      entry.append(revoke);
     }
     list.append(entry);
    }
    recentChanges.append(list);
   }
   const prior=result.selected;
   pendingChange=changes.find(x=>x.status==='pending')||null;
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
    pendingChange?'มีคำขอเปลี่ยนแพ็กเกจรอดำเนินการแล้ว (ยังไม่ตัดเงินและยังไม่เปลี่ยนสิทธิ์)':'เลือกแพ็กเกจใหม่เพื่อบันทึกคำขอเริ่มในรอบต่ออายุถัดไป':
    prior?'บันทึกแพ็กเกจไว้แล้ว · สถานะรอชำระเงิน (ยังไม่ถูกเรียกเก็บเงิน)':'';
  }catch{status.textContent='โหลดแพ็กเกจไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าของปั๊มหรือติดต่อผู้ดูแล';button.disabled=true;}
 }
 scheduleButton.addEventListener('click',async()=>{
  if(!activeSubscription||!scheduleAt||pendingChange||scheduling||!current||
     !quotedModulesKey||quotedModulesKey!==selectedModules().join(','))return;
  scheduling=true;scheduleButton.disabled=true;
  status.textContent='กำลังบันทึกคำขอเปลี่ยนแพ็กเกจ…';
  try{
   await request('/api/station/billing/change/schedule',{
    stationId,nextPlanId:current,paymentMethod:selectedMethod(),
    effectiveAt:scheduleAt,idempotencyKey:crypto.randomUUID(),
    targetModules:selectedModules(),
   });
   await load();
  }catch{status.textContent='บันทึกคำขอไม่สำเร็จ กรุณาตรวจวันเริ่มหรือคำขอเดิม';}
  finally{scheduling=false;viewSchedule();}
 });
 payment.addEventListener('change',viewPrice);
 switchDate.addEventListener('change',viewSchedule);
 moduleChoice.addEventListener('change',viewSchedule);
 button.addEventListener('click',async()=>{
  if(!current||activeSubscription||selectionSaved)return;
  button.disabled=true;status.textContent='กำลังบันทึกตัวเลือก…';
  try{
   const data=await request('/api/station/billing/select',{
    stationId,planId:current,paymentMethod:selectedMethod(),
   });
   selectionSaved=true;
   status.textContent=data?.status==='pending_payment'?
    'บันทึกเรียบร้อย · รอชำระเงิน '+baht(data.amountSatang)+' (ยังไม่ได้ตัดเงิน)':
    'บันทึกสำเร็จ';
  }catch{status.textContent='บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';}
  finally{button.disabled=activeSubscription||selectionSaved;}
 });
 load().catch(()=>{status.textContent='โหลดข้อมูลไม่ได้';});
}
