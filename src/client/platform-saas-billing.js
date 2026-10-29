/** Platform billing editor. The server owns every price and permission check. */
const currencyToSatang=value=>{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value))return null;
 const [whole,coins='']=value.split('.');
 return (BigInt(whole)*100n+BigInt(coins.padEnd(2,'0'))).toString();
};
const elem=(tag,label='')=>{const x=document.createElement(tag);if(label)x.textContent=label;return x;};
const opt=(value,label)=>{const x=elem('option',label);x.value=value;return x;};
function addFields(form,fields){
 for(const f of fields){
  const label=elem('label',f.label);label.className='field';
  const el=f.options?elem('select'):elem('input');
  el.name=f.name;el.required=true;
  if(!f.options){el.type=f.type||'text';if(f.step)el.step=f.step;
    if(f.type==='number'){el.min='0';el.max='100';}
  }else for(const [value,name] of f.options)el.append(opt(value,name));
  if(f.placeholder)el.placeholder=f.placeholder;
  label.append(el);form.append(label);
 }
}
const spec=[
 ['tax','ยืนยันนโยบายภาษี',[
  {label:'รูปแบบภาษี',name:'vatMode',options:[['exclusive','แยก VAT'],['inclusive','รวม VAT']]},
  {label:'อัตราภาษี (%)',name:'ratePercent',type:'number',step:'.01'},
  {label:'เริ่มมีผลวันที่',name:'effectiveOn',type:'date'}]],
 ['flat-plan','กำหนดแผนราคาเหมาจ่าย',[
  {label:'รหัสแผน (ไม่ซ้ำ)',name:'code',placeholder:'standard_2026'},
  {label:'ชื่อแผน',name:'name'},
  {label:'รอบชำระ',name:'frequency',options:[['monthly','รายเดือน'],['yearly','รายปี']]},
  {label:'QR Coupon (บาท/ปั๊ม)',name:'couponBaht',placeholder:'1500.00'},
  {label:'HR & Payroll (บาท/ปั๊ม)',name:'hrBaht',placeholder:'500.00'},
  {label:'ราคาเริ่มมีผลวันที่',name:'effectiveOn',type:'date'}]],
 ['group','สร้างกลุ่ม Billing (ปิด Auto Pay)',[
  {label:'องค์กร',name:'organizationId',options:[]},
  {label:'ชื่อกลุ่ม',name:'name'}]],
 ['subscription','สมัครสมาชิกให้สถานี (Trial)',[
  {label:'สถานี',name:'stationId',options:[]},
  {label:'แผนราคา',name:'planId',options:[]},
  {label:'รอบเริ่มต้น UTC',name:'startsOn',type:'date'},
  {label:'รอบสิ้นสุด UTC',name:'endsOn',type:'date'}]],
 ['draft','ร่างใบแจ้งหนี้จากราคาที่ตั้งไว้',[
  {label:'Billing Group',name:'billingGroupId',options:[]},
  {label:'ช่องทาง',name:'paymentMethod',options:[['card','บัตร'],['promptpay','PromptPay ลด 2%']]},
  {label:'วันเริ่มให้บริการ',name:'periodStart',type:'date'},
  {label:'วันสิ้นสุด (ไม่รวม)',name:'periodEnd',type:'date'}]],
];
export function mountPlatformSaasBilling({target,token}){
 if(!target)return;
 const section=elem('section');section.className='platform-saas-config';
 section.append(elem('h3','ตั้งค่า SaaS Billing — Platform Super Admin'),
   elem('p','ขั้นตอน: ภาษีที่ตรวจสอบแล้ว → แผนราคา → กลุ่มปั๊ม → Subscription → ร่างใบแจ้งหนี้ → ออกใบแจ้งหนี้'));
 const status=elem('p');status.setAttribute('role','status');section.append(status);
 const refresh=elem('button','รีเฟรชข้อมูล Billing');refresh.className='button secondary';
 refresh.type='button';section.append(refresh);
 const forms=elem('div');forms.className='billing-settings-layout';section.append(forms);
 const maps=new Map();
 for(const [key,title,fields] of spec){
  const form=elem('form');form.className='coupon-form';
  form.append(elem('h3',title));addFields(form,fields);
  if(key==='group'){
   const fieldset=elem('fieldset');fieldset.className='saas-station-fieldset';
   fieldset.append(elem('legend','เลือกปั๊มในองค์กรเดียวกัน'));
   const choices=elem('div');choices.id='billing-group-station-choices';
   fieldset.append(choices);form.append(fieldset);
  }
  const submit=elem('button','บันทึก / สร้างรายการ');
  submit.type='submit';submit.className='button secondary';form.append(submit);
  maps.set(key,form);forms.append(form);
 }
 const results=elem('div');results.className='billing-invoice-list';
 section.append(elem('h3','ตรวจร่างและออกใบแจ้งหนี้'),results);
 target.append(section);
 let loaded=null;
 const rpc=async(key,payload)=>{
  const init={cache:'no-store',headers:{authorization:'Bearer '+token}};
  if(payload!==undefined){
   init.method='POST';init.headers['content-type']='application/json';
   init.body=JSON.stringify(payload);
  }
  const response=await fetch('/api/platform/billing/'+key,init);
  if(!response.ok)throw new Error('not_authorized_or_invalid');
  return (await response.json()).result;
 };
 const select=(key,name)=>maps.get(key).elements.namedItem(name);
 const fill=(input,records,label)=>{
  input.replaceChildren(opt('','— เลือก —'));
  for(const r of records)input.append(opt(r.id,label(r)));
 };
 function groupStations(){
  const container=section.querySelector('#billing-group-station-choices');
  container.replaceChildren();
  const org=select('group','organizationId').value;
  const assigned=new Set((loaded?.groups||[]).flatMap(g=>g.stationIds||[]));
  for(const s of loaded?.stations||[]){
   if(s.organizationId!==org||assigned.has(s.id))continue;
   const label=elem('label');label.className='saas-station-pick';
   const box=elem('input');box.type='checkbox';box.value=s.id;
   label.append(box,document.createTextNode(' '+s.name));container.append(label);
  }
  if(!container.children.length)container.append(elem('p','ไม่มีปั๊มที่ยังไม่อยู่ใน Billing Group'));
 }
 function invoices(){
  results.replaceChildren();
  for(const invoice of loaded?.invoices||[]){
   const card=elem('article');card.className='billing-invoice-card';
   card.append(elem('strong',invoice.number+' · '+String(invoice.amountSatang)+' สตางค์'),
     elem('p',invoice.status+' · '+invoice.serviceStart+' ถึง '+invoice.serviceEnd));
   if(invoice.status==='draft'){
    const label=elem('label');label.className='saas-review-check';
    const checkbox=elem('input');checkbox.type='checkbox';
    label.append(checkbox,document.createTextNode(' ตรวจราคา ภาษี และส่วนลดของร่างแล้ว'));
    const button=elem('button','ยืนยันออกใบแจ้งหนี้');button.className='button primary';
    button.type='button';button.disabled=true;
    checkbox.addEventListener('change',()=>{button.disabled=!checkbox.checked;});
    button.addEventListener('click',()=>act('issue',{invoiceId:invoice.invoiceId},button));
    card.append(label,button);
   }
   results.append(card);
  }
 }
 async function load(){
  refresh.disabled=true;status.textContent='กำลังโหลด Billing…';
  try{
   loaded=await rpc('overview');
   fill(select('group','organizationId'),loaded.organizations||[],x=>x.name);
   fill(select('subscription','stationId'),loaded.stations||[],x=>x.name);
   fill(select('subscription','planId'),loaded.plans||[],x=>x.name+' ('+x.frequency+')');
   fill(select('draft','billingGroupId'),loaded.groups||[],x=>x.name);
   groupStations();invoices();
   status.textContent=loaded.taxPolicy?
    'นโยบายภาษีล่าสุด: '+loaded.taxPolicy.rateBasisPoints/100+'% ('+loaded.taxPolicy.vatMode+')':
    'ยังไม่มีนโยบายภาษีที่ตรวจสอบ กรุณากำหนดก่อนออกใบแจ้งหนี้';
  }catch{status.textContent='โหลด Billing ไม่สำเร็จ — ตรวจสิทธิ์ Platform Super Admin';}
  finally{refresh.disabled=false;}
 }
 async function act(route,body,button){
  button.disabled=true;status.textContent='กำลังบันทึก…';
  try{await rpc(route,body);await load();status.textContent='บันทึกสำเร็จ โปรดตรวจรายการอีกครั้ง';}
  catch{status.textContent='บันทึกไม่สำเร็จ — กรุณาตรวจสิทธิ์ วันที่ และข้อมูล';}
  finally{button.disabled=false;}
 }
 function bodyFor(key,d){
  if(key==='tax'){
   const pct=d.get('ratePercent');
   if(!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(pct))return null;
   const rateBasisPoints=Number(pct)*100;
   if(!Number.isInteger(rateBasisPoints))return null;
   return {vatMode:d.get('vatMode'),rateBasisPoints,effectiveOn:d.get('effectiveOn')};
  }
  if(key==='flat-plan'){
   const couponPriceSatang=currencyToSatang(d.get('couponBaht').trim());
   const hrPriceSatang=currencyToSatang(d.get('hrBaht').trim());
   return couponPriceSatang!==null&&hrPriceSatang!==null?{
    code:d.get('code').trim(),name:d.get('name').trim(),frequency:d.get('frequency'),
    couponPriceSatang,hrPriceSatang,effectiveOn:d.get('effectiveOn'),
   }:null;
  }
  if(key==='group'){
   const stationIds=[...section.querySelectorAll('#billing-group-station-choices input:checked')]
      .map(el=>el.value);
   return stationIds.length?{organizationId:d.get('organizationId'),
      name:d.get('name').trim(),stationIds}:null;
  }
  if(key==='subscription')return {stationId:d.get('stationId'),planId:d.get('planId'),
   startsAt:d.get('startsOn')+'T00:00:00Z',periodEnd:d.get('endsOn')+'T00:00:00Z'};
  if(key==='draft')return {billingGroupId:d.get('billingGroupId'),
   paymentMethod:d.get('paymentMethod'),periodStart:d.get('periodStart'),
   periodEnd:d.get('periodEnd')};
  return null;
 }
 for(const [key,form] of maps){
  form.addEventListener('submit',e=>{
   e.preventDefault();const body=bodyFor(key,new FormData(form));
   if(!body){status.textContent='กรุณากรอกข้อมูลให้ถูกต้อง';return;}
   act(key,body,form.querySelector('button[type=submit]'));
  });
 }
 select('group','organizationId').addEventListener('change',groupStations);
 refresh.addEventListener('click',load);
 load().catch(()=>{status.textContent='เชื่อมต่อ Billing ไม่สำเร็จ';});
}
