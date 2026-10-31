import {mountSaasPlanManager} from './saas-plan-manager.js';
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
 intro.append(el('h3','จัดการแพ็กเกจและราคา'),
   el('p','จัดการราคาและแพ็กเกจที่เจ้าของปั๊มเลือกใช้ พร้อมรักษาประวัติของลูกค้า'));
 root.append(intro);
 const tax=el('form');tax.className='coupon-form saas-simple-card os-tax-panel';
 tax.append(el('h3','1. นโยบายภาษีมูลค่าเพิ่ม'));
 const taxCurrent=el('p','กำลังโหลดนโยบาย…');taxCurrent.className='saas-current-summary';tax.append(taxCurrent);
 tax.append(field('วิธีคำนวณ VAT','vatMode',{options:[['exclusive','ราคาไม่รวม VAT'],['inclusive','ราคารวม VAT']]}),
  field('อัตรา VAT (%)','ratePercent',{type:'number',step:'0.01',min:0,max:100,placeholder:'7.00'}),
  field('เริ่มมีผลวันที่','effectiveOn',{type:'date'}));
 const saveTax=el('button','บันทึกนโยบาย VAT');saveTax.type='submit';saveTax.className='button primary';
 const taxStatus=feedback();tax.append(saveTax,taxStatus);
 target.append(root);
 async function rpc(path,payload){
  const init={cache:'no-store',headers:{authorization:'Bearer '+token}};
  if(payload!==undefined){init.method='POST';init.headers['content-type']='application/json';init.body=JSON.stringify(payload);}
  const r=await fetch('/api/platform/billing/'+path,init);
  const result=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(result.error||'billing_unavailable');
  return result.result;
 }

 mountSaasPlanManager({root,rpc});
 root.append(tax);
 async function loadTax(){
  try{const data=await rpc('overview');taxCurrent.textContent=policySummary(data.taxPolicy);}
  catch{taxCurrent.textContent='โหลดข้อมูล VAT ไม่สำเร็จ';}
 }
 tax.addEventListener('submit',async e=>{
  e.preventDefault();const d=new FormData(tax),rate=String(d.get('ratePercent')??'');
  if(!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(rate)){
   taxStatus.textContent='อัตรา VAT ไม่ถูกต้อง';return;
  }
  const rateBasisPoints=Number(rate)*100;
  if(!Number.isInteger(rateBasisPoints)){
   taxStatus.textContent='อัตรา VAT ไม่ถูกต้อง';return;
  }
  saveTax.disabled=true;taxStatus.textContent='กำลังบันทึก…';
  try{await rpc('tax',{vatMode:d.get('vatMode'),rateBasisPoints,effectiveOn:d.get('effectiveOn')});
   await loadTax();taxStatus.textContent='บันทึกนโยบาย VAT สำเร็จ';
  }catch{taxStatus.textContent='บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและสิทธิ์ของบัญชี';}
  finally{saveTax.disabled=false;}
 });
 loadTax();
}
