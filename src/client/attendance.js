/**
 * Employee GPS punch UI. An accepted network request creates a *pending* record,
 * not verified face attendance and not approved payroll hours.
 */
export function mountAttendanceWorkspace({target,token,stationId}){
  if(!target)return;
  target.innerHTML =
    '<div class="divider"></div>'+
    '<section class="attendance-workspace" aria-labelledby="attendance-heading">'+
      '<h2 id="attendance-heading">ลงเวลาเข้างานด้วย GPS</h2>'+
      '<p class="attendance-explainer">ขอพิกัดเมื่อกดลงเวลาเท่านั้น ผลการลงเวลายังต้องผ่านการตรวจสอบตามสิทธิ์ก่อนใช้คำนวณเงินเดือน</p>'+
      '<div class="attendance-actions">'+
        '<button type="button" class="button secondary" data-punch="clock_in">เข้างาน</button>'+
        '<button type="button" class="button secondary" data-punch="clock_out">ออกงาน</button>'+
        '<button type="button" class="button secondary" data-punch="break_start">เริ่มพัก</button>'+
        '<button type="button" class="button secondary" data-punch="break_end">กลับจากพัก</button>'+
      '</div>'+
      '<p id="attendance-message" role="status" aria-live="polite"></p>'+
      '<p class="hint">หาก GPS ใช้ไม่ได้หรืออยู่นอกพื้นที่ ให้แจ้งผู้จัดการเพื่อขอการตรวจสอบแบบสำรอง</p>'+
    '</section>';
  const notice=target.querySelector('#attendance-message');
  let busy=false;
  let pending=null;
  const show=(value,bad=false)=>{
    notice.textContent=value;
    notice.dataset.tone=bad?'error':'neutral';
  };
  async function submitPunch(eventType){
    if(busy)return;
    if(!navigator.geolocation || !crypto?.getRandomValues){
      show('อุปกรณ์นี้ไม่รองรับ GPS กรุณาแจ้งผู้จัดการเพื่อบันทึกเวลาแบบสำรอง',true);
      return;
    }
    busy=true;
    for(const item of target.querySelectorAll('[data-punch]'))item.disabled=true;
    try{
      let data;
      if(pending && pending.eventType===eventType){
        // A network retry must reuse exactly the same GPS payload and idempotency key.
        data=pending;
      }else{
        show('กำลังขออนุญาตเข้าถึงตำแหน่ง GPS…');
        const position=await new Promise((resolve,reject)=>
          navigator.geolocation.getCurrentPosition(resolve,reject,
            {enableHighAccuracy:true,timeout:15000,maximumAge:0}));
        const {latitude,longitude,accuracy}=position.coords;
        if(![latitude,longitude,accuracy].every(Number.isFinite))
          throw new Error('invalid_position');
        const nonce=crypto.getRandomValues(new Uint8Array(18));
        data={stationId,eventType,latitude,longitude,accuracyMeters:accuracy,
          idempotencyKey:'gps-'+[...nonce].map(x=>x.toString(16).padStart(2,'0')).join('')};
        pending=data;
      }
      show('กำลังส่งคำขอลงเวลาอย่างปลอดภัย…');
      const res=await fetch('/api/hr/attendance/gps',{
        method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
        body:JSON.stringify(data),cache:'no-store',
      });
      const body=await res.json().catch(()=>({}));
      if(res.ok){
        pending=null;
        show('บันทึกเวลารับเรื่องแล้ว (รออนุมัติ) — ยังไม่ใช่ชั่วโมงงานที่อนุมัติ');
      }else{
        // An explicit application error is definitive; no retry of a rejected operation.
        pending=null;
        show(body.error==='attendance_conflict'?
          'คำขอลงเวลาซ้ำหรือข้อมูลไม่ตรง กรุณาแจ้งผู้จัดการ':
          'ไม่สามารถบันทึกเวลาได้ กรุณาตรวจสิทธิ์พนักงานและแจ้งผู้จัดการ',true);
      }
    }catch{
      show('ไม่สามารถยืนยันการรับคำขอได้ กดปุ่มเดิมเพื่อลองส่งซ้ำโดยไม่สร้างรายการใหม่',true);
    }finally{
      busy=false;
      for(const item of target.querySelectorAll('[data-punch]'))item.disabled=false;
    }
  }
  for(const item of target.querySelectorAll('[data-punch]')){
    item.addEventListener('click',()=>submitPunch(item.dataset.punch));
  }
}
