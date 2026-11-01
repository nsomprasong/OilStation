// Manager-only HR controls. Never auto-bind an employee or auto-save browser GPS.
// All mutations go through server-authorized station-scoped RPCs.
const roleNames={cashier:'แคชเชียร์',attendant:'พนักงานปั๊ม',pump_staff:'พนักงานหน้าลาน'};
const numberIn=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const opt=(value,label)=>{
 const o=document.createElement('option');o.value=value;o.textContent=label;return o;
};
export async function mountHrAccessSetup({target,stationId,token,getApi}){
 if(!target)return;
 target.innerHTML=`
  <h3>บัญชีพนักงานและเขตลงเวลา</h3>
  <p class="os-section-copy">เชื่อมบัญชีพนักงานที่ได้รับเชิญเข้าปั๊มนี้แล้วเท่านั้น การลงเวลาผ่าน GPS จะรอผู้จัดการตรวจสอบก่อนเสมอ</p>
  <div class="hr-access-grid">
   <form id="hr-account-link" class="coupon-form hr-access-card">
    <h4>เชื่อมบัญชีเข้ากับพนักงาน</h4>
    <label class="field">พนักงานที่ยังไม่ได้เชื่อม
     <select id="hr-link-employee" required aria-label="พนักงานที่ยังไม่ได้เชื่อมบัญชี"></select>
    </label>
    <label class="field">บัญชีพนักงานที่อยู่ในปั๊มนี้
     <select id="hr-link-user" required aria-label="บัญชีพนักงานในปั๊ม"></select>
    </label>
    <p class="hint">บัญชีหนึ่งเชื่อมได้กับพนักงานหนึ่งคนเท่านั้น และไม่อนุญาตให้เปลี่ยนบัญชีโดยอัตโนมัติ</p>
    <button class="button primary" type="submit" id="hr-link-save">เชื่อมบัญชี</button>
   </form>
   <form id="hr-geofence-form" class="coupon-form hr-access-card">
    <h4>กำหนดเขตลงเวลา GPS</h4>
    <div class="hr-geo-coordinates">
     <label class="field">ละติจูด <input id="hr-geo-lat" type="number" step="any" min="-90" max="90" required inputmode="decimal"></label>
     <label class="field">ลองจิจูด <input id="hr-geo-lon" type="number" step="any" min="-180" max="180" required inputmode="decimal"></label>
    </div>
    <div class="hr-geo-coordinates">
     <label class="field">รัศมี (เมตร) <input id="hr-geo-radius" type="number" min="50" max="1500" value="150" required></label>
     <label class="field">ความคลาดเคลื่อนสูงสุด (เมตร) <input id="hr-geo-accuracy" type="number" min="5" max="500" value="100" required></label>
    </div>
    <button class="button secondary" id="hr-geo-position" type="button">อ่านตำแหน่งอุปกรณ์</button>
    <p class="hint">ตำแหน่งอุปกรณ์จะใช้เติมช่องข้อมูลเท่านั้น ต้องกดบันทึกเอง หากปฏิเสธการเข้าถึงตำแหน่งสามารถกรอกค่าที่ตรวจสอบแล้วได้</p>
    <button class="button primary" type="submit" id="hr-geo-save">บันทึกเขต GPS</button>
   </form>
  </div>
  <p id="hr-access-status" role="status" aria-live="polite" class="notice" hidden></p>
 `;
 const $=id=>target.querySelector('#'+id);
 const linkForm=$('hr-account-link'),geoForm=$('hr-geofence-form');
 const linkSave=$('hr-link-save'),geoSave=$('hr-geo-save');
 const status=$('hr-access-status');
 const announce=(text,error=false)=>{status.hidden=false;status.textContent=text;status.dataset.tone=error?'error':'neutral';};
 const api=(path,body)=>getApi(path,token,body===undefined?{}:{
  method:'POST',body:JSON.stringify(body),
 });
 let available=false;
 async function refresh(){
  const response=await api('/api/hr/link-setup?stationId='+encodeURIComponent(stationId)).catch(()=>null);
  available=Boolean(response?.ok&&response.data?.setup);
  const employees=$('hr-link-employee'),users=$('hr-link-user');
  const prevEmployee=employees.value,prevUser=users.value;
  employees.replaceChildren();users.replaceChildren();
  if(!available){
   linkSave.disabled=true;geoSave.disabled=true;
   announce('ยังโหลดบัญชีพนักงานหรือการตั้งค่า GPS ไม่ได้ โปรดตรวจสิทธิ์และสถานะ HR ของปั๊ม',true);
   return;
  }
  const setup=response.data.setup;
  const unlinked=(setup.employees||[]).filter(e=>!e.linked);
  const freeAccounts=setup.accounts||[];
  for(const e of unlinked)employees.append(opt(e.id,e.name+' ('+e.code+')'));
  for(const u of freeAccounts)users.append(opt(u.userId,u.name+' · '+(roleNames[u.role]||u.role)));
  if(unlinked.some(e=>e.id===prevEmployee))employees.value=prevEmployee;
  if(freeAccounts.some(u=>u.userId===prevUser))users.value=prevUser;
  linkSave.disabled=unlinked.length===0||freeAccounts.length===0;
  geoSave.disabled=false;
  const g=setup.geofence;
  if(g?.configured){
   $('hr-geo-lat').value=String(g.latitude);
   $('hr-geo-lon').value=String(g.longitude);
   $('hr-geo-radius').value=String(g.radiusMeters);
   $('hr-geo-accuracy').value=String(g.maxAccuracyMeters);
  }
  if(!unlinked.length||!freeAccounts.length)
   announce('ยังไม่มีคู่พนักงานกับบัญชีที่สามารถเชื่อมเพิ่มเติมได้ กรุณาเชิญพนักงานหน้าลานเข้าปั๊มก่อน');
  else if(status.dataset.tone==='error'){status.hidden=true;}
 }
 linkForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!available||linkSave.disabled)return;
  const employeeId=$('hr-link-employee').value,userId=$('hr-link-user').value;
  if(!employeeId||!userId)return announce('กรุณาเลือกพนักงานและบัญชีผู้ใช้งาน',true);
  linkSave.disabled=true;
  try{
   const res=await api('/api/hr/employee-link',{stationId,employeeId,userId});
   if(!res.ok){announce('เชื่อมบัญชีไม่ได้ ตรวจสอบสิทธิ์หรือว่าบัญชีนี้ถูกเชื่อมแล้ว',true);return;}
   announce(res.data?.result?.replayed?'บัญชีนี้เชื่อมอยู่แล้ว':'เชื่อมบัญชีพนักงานสำเร็จ');
   await refresh();
  }catch{announce('เชื่อมบัญชีไม่ได้ กรุณาตรวจสอบเครือข่าย',true);}
  finally{if(available&&$('hr-link-employee').options.length&&$('hr-link-user').options.length)linkSave.disabled=false;}
 });
 $('hr-geo-position').addEventListener('click',()=>{
  if(!navigator.geolocation){announce('อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง สามารถกรอกพิกัดเองได้',true);return;}
  const b=$('hr-geo-position');b.disabled=true;
  navigator.geolocation.getCurrentPosition(
   pos=>{
    $('hr-geo-lat').value=pos.coords.latitude.toFixed(7);
    $('hr-geo-lon').value=pos.coords.longitude.toFixed(7);
    announce('อ่านพิกัดแล้ว กรุณายืนยันว่าเป็นตำแหน่งปั๊มก่อนกดบันทึก (ความคลาดเคลื่อน '+Math.round(pos.coords.accuracy)+' เมตร)');
    b.disabled=false;
   },
   ()=>{announce('อ่านตำแหน่งไม่ได้หรือไม่ได้รับอนุญาต กรุณากรอกพิกัดเอง',true);b.disabled=false;},
   {enableHighAccuracy:true,timeout:12000,maximumAge:0},
  );
 });
 geoForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!available||geoSave.disabled)return;
  const latitude=Number($('hr-geo-lat').value),longitude=Number($('hr-geo-lon').value),
    radiusMeters=Number($('hr-geo-radius').value),maxAccuracyMeters=Number($('hr-geo-accuracy').value);
  if(!$('hr-geo-lat').value||!$('hr-geo-lon').value||
    !numberIn(latitude,-90,90)||!numberIn(longitude,-180,180)||
    !Number.isInteger(radiusMeters)||!numberIn(radiusMeters,50,1500)||
    !Number.isInteger(maxAccuracyMeters)||!numberIn(maxAccuracyMeters,5,500))
   return announce('พิกัดหรือรัศมีไม่ถูกต้อง',true);
  geoSave.disabled=true;
  try{
   const r=await api('/api/hr/geofence',{stationId,latitude,longitude,radiusMeters,maxAccuracyMeters});
   if(!r.ok)return announce('บันทึกเขต GPS ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์',true);
   announce('บันทึกเขต GPS แล้ว รายการลงเวลายังคงรอการตรวจสอบตามปกติ');
  }catch{announce('เชื่อมต่อเพื่อบันทึกเขต GPS ไม่ได้',true);}
  finally{geoSave.disabled=!available;}
 });
 await refresh();
 return {refresh};
}
