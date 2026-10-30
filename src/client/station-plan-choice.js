/** Invited station owner's simple plan/payment choice. No charge is initiated. */
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
 const button=node('button','ยืนยันแพ็กเกจและวิธีชำระเงิน');button.className='button primary';button.type='button';
 const status=node('p');status.setAttribute('role','status');status.className='owner-plan-status';
 const info=node('p','ระบบบันทึกตัวเลือกไว้ก่อน โดยยังไม่ตัดเงินหรือเริ่ม Subscription จนกว่าจะมีการยืนยันการชำระเงิน');info.className='hint';
 section.append(steps,station,caption,plans,payment,quote,button,status,info);target.append(section);
 let rows=[],current=null;
 const selectedMethod=()=>payment.querySelector('input:checked')?.value||'card';
 const viewPrice=()=>{
  const chosen=rows.find(row=>row.id===current);
  if(!chosen){quote.textContent='กรุณาเลือกแพ็กเกจ';button.disabled=true;return;}
  const q=chosen[selectedMethod()];
  quote.replaceChildren();
  if(!q){quote.textContent='ยังไม่มีราคาสำหรับแพ็กเกจนี้';button.disabled=true;return;}
  button.disabled=false;
  const details=node('div');
  details.append(node('p','ราคาบริการ '+baht(q.subtotalSatang)),
   node('p','ส่วนลด '+baht(q.discountSatang)),
   node('p','VAT '+baht(q.taxSatang)));
  const total=node('strong','ยอดตามแพ็กเกจ '+baht(q.totalSatang));
  quote.append(details,total);
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
   current=prior?.planId||rows[0]?.id||null;
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
   status.textContent=prior?
    'บันทึกแพ็กเกจไว้แล้ว · สถานะรอชำระเงิน (ยังไม่ถูกเรียกเก็บเงิน)':
    '';
  }catch{status.textContent='โหลดแพ็กเกจไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าของปั๊มหรือติดต่อผู้ดูแล';button.disabled=true;}
 }
 payment.addEventListener('change',viewPrice);
 button.addEventListener('click',async()=>{
  if(!current)return;
  button.disabled=true;status.textContent='กำลังบันทึกตัวเลือก…';
  try{
   const data=await request('/api/station/billing/select',{
    stationId,planId:current,paymentMethod:selectedMethod(),
   });
   status.textContent=data?.status==='pending_payment'?
    'บันทึกเรียบร้อย · รอชำระเงิน '+baht(data.amountSatang)+' (ยังไม่ได้ตัดเงิน)':
    'บันทึกสำเร็จ';
  }catch{status.textContent='บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';}
  finally{button.disabled=false;}
 });
 load().catch(()=>{status.textContent='โหลดข้อมูลไม่ได้';});
}
