/** OilStation SaaS pricing settings: two owner tasks, tax and plans only.
 * Historic invoice/group/subscription APIs remain for the separate checkout flow.
 */
const moneyToSatang = value => {
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value))return null;
 const [whole,cents='']=value.split('.');
 return (BigInt(whole)*100n+BigInt(cents.padEnd(2,'0'))).toString();
};
export const formattedBaht=satang=>{
 if(!/^(?:0|[1-9]\d{0,15})$/.test(String(satang??'')))return '—';
 const n=BigInt(satang);return (n/100n).toLocaleString('th-TH')+'.'+(n%100n).toString().padStart(2,'0')+' บาท';
};
const el=(name,txt)=>{const n=document.createElement(name);if(txt!==undefined)n.textContent=txt;return n;};
function field(title,name,{type='text',options,placeholder,required=true,step,max,min}={}){
 const wrap=el('label',title);wrap.className='field';
 const input=el(options?'select':'input');input.name=name;input.required=required;
 if(options){for(const [value,label] of options){const o=el('option',label);o.value=value;input.append(o);}}
 else{input.type=type;if(placeholder)input.placeholder=placeholder;
  if(step)input.step=step;if(min!==undefined)input.min=String(min);if(max!==undefined)input.max=String(max);}
 wrap.append(input);return wrap;
}
function feedback(text=''){
 const p=el('p',text);p.className='saas-simple-status';p.setAttribute('role','status');return p;
}
function policySummary(value){
 if(!value)return 'ยังไม่ได้กำหนดนโยบาย VAT';
 const type=value.vatMode==='inclusive'?'ราคาที่แสดงรวม VAT':'คิด VAT แยกจากราคา';
 return type+' · '+(value.rateBasisPoints/100)+'% · มีผลวันที่ '+value.effectiveOn;
}
export function mountPlatformSaasBilling({target,token}){
 if(!target)return;
 target.replaceChildren();
 const root=el('div');root.className='saas-simple-layout';
 const intro=el('div');intro.className='saas-simple-intro';
 intro.append(el('h3','ตั้งค่าเพียง 2 อย่าง'),
   el('p','กำหนด VAT และสร้างแพ็กเกจที่ลูกค้าจะเลือกเอง หลังจากได้รับคำเชิญเข้าปั๊ม'));
 root.append(intro);
 const tax=el('form');tax.className='coupon-form saas-simple-card';
 tax.append(el('h3','1. นโยบายภาษีมูลค่าเพิ่ม'));
 const taxCurrent=el('p','กำลังโหลดนโยบาย…');taxCurrent.className='saas-current-summary';tax.append(taxCurrent);
 tax.append(field('วิธีคำนวณ VAT','vatMode',{options:[['exclusive','ราคาไม่รวม VAT'],['inclusive','ราคารวม VAT']]}),
  field('อัตรา VAT (%)','ratePercent',{type:'number',step:'0.01',min:0,max:100,placeholder:'7.00'}),
  field('เริ่มมีผลวันที่','effectiveOn',{type:'date'}));
 const saveTax=el('button','บันทึกนโยบาย VAT');saveTax.type='submit';saveTax.className='button primary';
 const taxStatus=feedback();tax.append(saveTax,taxStatus);
 const plan=el('form');plan.className='coupon-form saas-simple-card';
 plan.append(el('h3','2. สร้างแพ็กเกจราคา'),
   el('p','กำหนดราคาต่อปั๊มตามบริการที่เปิดใช้งาน ลูกค้าเลือกแพ็กเกจหลังตอบรับคำเชิญ'));
 plan.append(field('ชื่อแพ็กเกจ','name',{placeholder:'เช่น Standard'}),
  field('รหัสแพ็กเกจ (ภาษาอังกฤษ)','code',{placeholder:'standard_monthly'}),
  field('รอบชำระเงิน','frequency',{options:[['monthly','รายเดือน'],['yearly','รายปี']]}),
  field('QR Coupon (บาท/ปั๊ม)','couponBaht',{placeholder:'1500.00'}),
  field('HR & Payroll (บาท/ปั๊ม)','hrBaht',{placeholder:'500.00'}),
  field('เริ่มมีผลวันที่','effectiveOn',{type:'date'}));
 const savePlan=el('button','สร้างแพ็กเกจ');savePlan.type='submit';savePlan.className='button primary';
 const planStatus=feedback();plan.append(savePlan,planStatus);
 const current=el('section');current.className='saas-simple-card saas-existing-plans';
 const bar=el('div');bar.className='saas-plan-heading';
 bar.append(el('h3','แพ็กเกจที่มีอยู่'));
 const refresh=el('button','รีเฟรช');refresh.type='button';refresh.className='button secondary';bar.append(refresh);
 const planItems=el('div');planItems.className='saas-plan-list';
 const summaryStatus=feedback();
 current.append(bar,planItems,summaryStatus);
 root.append(tax,plan,current);target.append(root);
 async function rpc(path,payload){
  const init={cache:'no-store',headers:{authorization:'Bearer '+token}};
  if(payload!==undefined){init.method='POST';init.headers['content-type']='application/json';init.body=JSON.stringify(payload);}
  const r=await fetch('/api/platform/billing/'+path,init);
  if(!r.ok)throw new Error('billing_unavailable');
  return (await r.json()).result;
 }
 function paintPlans(plans){
  planItems.replaceChildren();
  if(!plans.length){planItems.append(el('p','ยังไม่มีแพ็กเกจ สร้างแพ็กเกจแรกได้จากแบบฟอร์มด้านบน'));return;}
  for(const p of plans){
   const card=el('article');card.className='saas-plan-row';
   const main=el('div');main.className='saas-plan-meta';
   main.append(el('strong',p.name),el('small',p.code+' · '+(p.frequency==='yearly'?'รายปี':'รายเดือน')));
   const prices=el('div');prices.className='saas-plan-prices';
   const get=(code)=>p.rules?.find(r=>r.moduleCode===code)?.priceSatang;
   prices.append(el('span','QR Coupon '+formattedBaht(get('qr_coupon'))),
    el('span','HR & Payroll '+formattedBaht(get('hr_payroll'))));
   card.append(main,prices);planItems.append(card);
  }
 }
 async function load(){
  refresh.disabled=true;summaryStatus.textContent='กำลังโหลดข้อมูล…';
  try{
   const data=await rpc('overview');
   taxCurrent.textContent=policySummary(data.taxPolicy);
   paintPlans(data.plans||[]);
   summaryStatus.textContent='';
  }catch{
   taxCurrent.textContent='ยังไม่สามารถโหลดนโยบายได้';
   planItems.replaceChildren();
   summaryStatus.textContent='โหลดข้อมูลไม่สำเร็จ กรุณาลองรีเฟรชอีกครั้ง';
  }finally{refresh.disabled=false;}
 }
 async function submit(route,body,button,status){
  button.disabled=true;status.textContent='กำลังบันทึก…';
  try{await rpc(route,body);status.textContent='บันทึกสำเร็จ';await load();}
  catch{status.textContent='บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและสิทธิ์ของบัญชี';}
  finally{button.disabled=false;}
 }
 tax.addEventListener('submit',e=>{
  e.preventDefault();
  const d=new FormData(tax),rate=String(d.get('ratePercent')??'');
  if(!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(rate)){
   taxStatus.textContent='อัตรา VAT ไม่ถูกต้อง';return;
  }
  const rateBasisPoints=Number(rate)*100;
  if(!Number.isInteger(rateBasisPoints)){taxStatus.textContent='อัตรา VAT ไม่ถูกต้อง';return;}
  submit('tax',{vatMode:d.get('vatMode'),rateBasisPoints,effectiveOn:d.get('effectiveOn')},saveTax,taxStatus);
 });
 plan.addEventListener('submit',e=>{
  e.preventDefault();
  const d=new FormData(plan);
  const couponPriceSatang=moneyToSatang(String(d.get('couponBaht')??'').trim());
  const hrPriceSatang=moneyToSatang(String(d.get('hrBaht')??'').trim());
  if(couponPriceSatang===null||hrPriceSatang===null||
     BigInt(couponPriceSatang)+BigInt(hrPriceSatang)<1000n){
   planStatus.textContent='กรุณาระบุราคาให้ถูกต้อง โดยยอดรวมต้องไม่น้อยกว่า 10 บาท';return;
  }
  const body={code:String(d.get('code')??'').trim(),name:String(d.get('name')??'').trim(),
    frequency:d.get('frequency'),couponPriceSatang,hrPriceSatang,effectiveOn:d.get('effectiveOn')};
  submit('flat-plan',body,savePlan,planStatus);
 });
 refresh.addEventListener('click',load);
 load();
}
