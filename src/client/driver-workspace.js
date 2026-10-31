import QRCode from 'qrcode';

const $=(parent,tag,className,text)=>{
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!=null)el.textContent=text;
 parent.appendChild(el);return el;
};
const money=s=>{
 const n=BigInt(/^[0-9]+$/.test(String(s))?s:'0');
 return '฿'+(n/100n).toLocaleString('th-TH')+'.'+String(n%100n).padStart(2,'0');
};
const request=async(path,token,body)=>{
 const res=await fetch(path,{method:body?'POST':'GET',cache:'no-store',
 headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})});
 return {ok:res.ok,status:res.status,data:await res.json().catch(()=>({}))};
};

/** Company dispatcher: choose a real driver membership and assign the current
 * vehicle by plate. Issuing a QR is separate and always requires current car. */
export function mountCompanyDriverAssignment({target,token,accountSelect,onSelect}){
 if(!target)return;
 target.replaceChildren();
 const heading=$(target,'h3','section-title','คนขับรถและทะเบียนประจำรถ');
 $(target,'p','hint','บริษัทกำหนดรถที่คนขับกำลังใช้งานก่อนออก QR คนขับแก้ทะเบียนหรือวงเงินเองไม่ได้');
 const form=$(target,'form','coupon-form');
 const driverLabel=$(form,'label','field','เลือกพนักงานขับรถ');
 const driver=$(driverLabel,'select');driver.required=true;
 const plateLabel=$(form,'label','field','ทะเบียนรถที่คนขับใช้งาน');
 const plate=$(plateLabel,'input');plate.required=true;plate.maxLength=20;
 plate.placeholder='เช่น กข 1234';plate.autocomplete='off';
 const submit=$(form,'button','button primary','ผูกทะเบียนกับคนขับ');
 submit.type='submit';
 const status=$(form,'p','hint');status.setAttribute('role','status');
 const rosterNode=$(target,'div','module-list');
 let roster=[];
 let loadedCompany=null;
 async function refresh(){
  const account=(accountSelect?.()||null);
  const companyId=account?.companyId||null;
  roster=[];driver.replaceChildren();rosterNode.replaceChildren();
  loadedCompany=companyId;
  if(!companyId){status.textContent='ยังไม่ได้เลือกบริษัท';onSelect?.([]);return;}
  status.textContent='กำลังโหลดคนขับจากบัญชีบริษัท…';
  try{
   const res=await request('/api/corporate/drivers?companyId='+encodeURIComponent(companyId),token);
   if(!res.ok)throw Error('not_allowed');
   roster=res.data.drivers||[];
   for(const d of roster){
    const option=document.createElement('option');option.value=d.userId;
    option.textContent=d.displayName+(d.plate?' · '+d.plate:' · ยังไม่กำหนดรถ');
    driver.appendChild(option);
   }
   status.textContent=roster.length?'เลือกคนขับและกำหนดทะเบียนรถ':'ยังไม่มีสมาชิกบทบาทคนขับในบริษัท ต้องสร้างหรือเชิญคนขับก่อน';
   submit.disabled=roster.length===0;
   roster.forEach(d=>{
    const item=$(rosterNode,'div','module-item');
    $(item,'strong',null,d.displayName);
    $(item,'p','module-subtitle',d.plate?'รถปัจจุบัน: '+d.plate:'ยังไม่กำหนดรถ');
   });
   driver.dispatchEvent(new Event('change'));
   onSelect?.(roster);
  }catch{status.textContent='โหลดสิทธิ์คนขับไม่ได้';submit.disabled=true;onSelect?.([]);}
 }
 driver.addEventListener('change',()=>{
  plate.value=roster.find(d=>d.userId===driver.value)?.plate||'';
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const account=accountSelect?.(),p=plate.value.trim();
  if(!account?.companyId||!driver.value||p.length<4||p.length>20){
   status.textContent='กรุณาเลือกคนขับและระบุทะเบียนรถ 4–20 ตัวอักษร';return;
  }
  submit.disabled=true;status.textContent='กำลังตรวจสอบความสัมพันธ์ของคนขับและรถ…';
  try{
   const res=await request('/api/corporate/driver-vehicle',token,{
    companyId:account.companyId,driverUserId:driver.value,plate:p,
   });
   if(!res.ok){status.textContent=res.status===409?
    'คนขับหรือรถมีคูปองที่ยังใช้งานอยู่ ต้องยกเลิกคูปองเดิมก่อนเปลี่ยนทะเบียน':
    'ผูกรถไม่สำเร็จ ('+(res.data.error||'ไม่มีสิทธิ์')+')';return;}
   await refresh();
   status.textContent='บันทึกรถและทะเบียนให้คนขับแล้ว พร้อมออก QR';
  }catch{status.textContent='ไม่สามารถยืนยันการผูกรถได้ โปรดลองโหลดใหม่';}
  finally{submit.disabled=false;}
 });
 refresh();
 return {refresh,selected:()=>roster.find(d=>d.userId===driver.value)};
}

/** Read-only driver wallet view; QR generated from server-attested assigned
 * coupons, never from an untrusted ID or other employees' records. */
export function mountDriverWorkspace({target,token}){
 if(!target)return;
 target.replaceChildren();
 const heading=$(target,'h2',null,'คูปองเติมน้ำมันของฉัน');
 $(target,'p','lead','QR ที่บริษัทออกให้จะปรากฏที่นี่โดยอัตโนมัติ ไม่ต้องรับผ่าน LINE');
 const vehicles=$(target,'div','module-list');
 const refresh=$(target,'button','button secondary','รีเฟรชคูปอง');
 refresh.type='button';
 const status=$(target,'p','hint');status.setAttribute('role','status');
 const list=$(target,'div','module-list');
 let loading=false,closed=false;
 async function reload(){
  if(loading||closed||!target.isConnected)return;
  loading=true;refresh.disabled=true;
  try{
   const res=await request('/api/driver/coupons',token);
   if(!res.ok)throw Error('not_authorized');
   vehicles.replaceChildren();list.replaceChildren();
   const cars=res.data.vehicles||[];
   if(!cars.length)$(vehicles,'p','hint','ยังไม่มีทะเบียนรถที่บริษัทมอบหมาย โปรดติดต่อผู้ดูแลบริษัท');
   for(const car of cars){
    const node=$(vehicles,'article','module-item');
    $(node,'strong',null,car.driverName||'คนขับ');
    $(node,'div','money','ทะเบียน '+car.plate);
    if(car.province)$(node,'p','module-subtitle',car.province);
   }
   const coupons=res.data.coupons||[];
   if(!coupons.length)$(list,'p','hint','ยังไม่มี QR ที่บริษัทออกให้');
   for(const coupon of coupons){
    const card=$(list,'article','module-item');
    const usable=coupon.qrPayload&&['reserved','verified'].includes(coupon.status)&&
      Date.parse(coupon.expiresAt)>Date.now();
    $(card,'strong',null,coupon.stationName+' · '+coupon.fuelName);
    $(card,'p','module-subtitle','ทะเบียนที่ผูกกับคูปอง: '+(coupon.plate||'—'));
    $(card,'div','money',money(coupon.maxAmountSatang));
    $(card,'p','hint','สถานะ: '+coupon.status+' · หมดอายุ '+new Date(coupon.expiresAt).toLocaleString('th-TH'));
    if(usable){
     const canvas=$(card,'canvas','qr-wrapper');canvas.setAttribute('aria-label','QR สำหรับเติมน้ำมัน');
     await QRCode.toCanvas(canvas,coupon.qrPayload,{width:240,margin:3});
     $(card,'p','hint','แสดง QR นี้ให้พนักงานหน้าลานสแกน · ห้ามแก้ไขทะเบียนหรือยอด');
    }else $(card,'p','hint','คูปองนี้ไม่พร้อมใช้งาน ไม่แสดง QR');
   }
   status.textContent='แสดงเฉพาะรถและคูปองที่ผูกกับบัญชีคนขับนี้';
  }catch{status.textContent='โหลดคูปองไม่สำเร็จ กรุณาลองอีกครั้ง';}
  finally{loading=false;refresh.disabled=false;}
 }
 refresh.addEventListener('click',reload);
 const timer=setInterval(()=>{
  if(!document.hidden && target.isConnected && !target.closest('[data-ws-screen]')?.hidden)reload();
 },15000);
 target.addEventListener('oilstation:destroy',()=>{closed=true;clearInterval(timer);},{once:true});
 reload();
}
