/** Thai mobile supervisor queue; manual fallback, not AI face recognition. */
export function mountAttendanceReview({target,token,stationId}){
 if(!target)return;
 target.innerHTML=
  '<div class="divider"></div><section class="attendance-review" aria-label="อนุมัติบันทึกเวลา">'+
  '<div class="section-title">ตรวจสอบการลงเวลาพนักงาน</div>'+
  '<p class="hint">GPS เป็นเพียงข้อมูลประกอบ ต้องยืนยันหลักฐานตามขั้นตอนและระบุเหตุผลการอนุมัติแบบแมนนวลทุกครั้ง</p>'+
  '<button id="load-attendance-review" class="button secondary" type="button">โหลดรายการรอตรวจ</button>'+
  '<div class="attendance-review-list" id="attendance-review-list"></div></section>';
 const button=target.querySelector('#load-attendance-review');
 const list=target.querySelector('#attendance-review-list');
 const types={clock_in:'เข้างาน',clock_out:'ออกงาน',break_start:'เริ่มพัก',break_end:'กลับจากพัก'};
 const geo={inside:'ในรัศมี',outside:'นอกรัศมี',uncertain:'GPS ไม่แม่นยำ',unconfigured:'ไม่ได้ตั้งพิกัดสถานี'};
 const api=async(path,body=null)=>{
  const options={headers:{authorization:'Bearer '+token},cache:'no-store'};
  if(body!==null){
   options.method='POST';options.headers['content-type']='application/json';
   options.body=JSON.stringify(body);
  }
  const response=await fetch(path,options);
  if(!response.ok)throw new Error('attendance_error');
  return response.json();
 };
 async function load(){
  button.disabled=true;list.replaceChildren();
  const placeholder=document.createElement('p');placeholder.textContent='กำลังโหลดการลงเวลาที่รออนุมัติ…';
  list.appendChild(placeholder);
  try{
   const data=await api('/api/hr/attendance/pending?stationId='+encodeURIComponent(stationId));
   list.replaceChildren();
   if(!data.events?.length){
    placeholder.textContent='ไม่มีรายการลงเวลาที่รอตรวจ';list.appendChild(placeholder);return;
   }
   for(const item of data.events){
    const card=document.createElement('article');card.className='attendance-review-card';
    const heading=document.createElement('strong');
    heading.textContent=(item.employeeName||'พนักงาน')+' · '+(types[item.eventType]||'บันทึกเวลา');
    const time=document.createElement('p');
    const date=new Date(item.occurredAt);
    time.textContent='วันที่เวลา '+(Number.isNaN(date.getTime())?'—':date.toLocaleString('th-TH'));
    const gps=document.createElement('p');gps.className='attendance-geofence';
    gps.textContent='GPS: '+(geo[item.geofenceStatus]||'ไม่มีข้อมูล')+
      ' · ความคลาดเคลื่อน '+(item.accuracyMeters??'—')+' เมตร';
    gps.dataset.status=item.geofenceStatus||'unconfigured';
    const reason=document.createElement('textarea');
    reason.rows=2;reason.maxLength=1000;
    reason.placeholder='เหตุผลและหลักฐานประกอบการตรวจสอบอย่างน้อย 10 ตัวอักษร';
    reason.setAttribute('aria-label','เหตุผลการตรวจลงเวลาแบบแมนนวล');
    const accept=document.createElement('button');
    accept.className='button primary';accept.type='button';accept.textContent='อนุมัติหลังตรวจสอบ';
    const reject=document.createElement('button');
    reject.className='button secondary';reject.type='button';reject.textContent='ไม่อนุมัติ';
    const controls=document.createElement('div');controls.className='attendance-review-actions';
    controls.append(accept,reject);
    const status=document.createElement('p');status.setAttribute('role','status');
    card.append(heading,time,gps,reason,controls,status);list.appendChild(card);
    async function decide(approved){
      if(reason.value.trim().length<10){
        status.textContent='โปรดระบุเหตุผลการตรวจสอบอย่างน้อย 10 ตัวอักษร';return;
      }
      accept.disabled=true;reject.disabled=true;
      try{
       const result=await api('/api/hr/attendance/review',{
        eventId:item.eventId,approved,reason:reason.value.trim(),
       });
       status.textContent=result.result?.status==='accepted'?
         'ตรวจยืนยันแบบแมนนวลแล้ว (ไม่มีการอ้างยืนยันใบหน้า)':
         'บันทึกปฏิเสธแล้ว';
       controls.replaceChildren();
      }catch{
       status.textContent='บันทึกไม่ได้ กรุณาตรวจสิทธิ์และสถานะการอนุมัติ';
       accept.disabled=false;reject.disabled=false;
      }
    }
    accept.addEventListener('click',()=>decide(true));
    reject.addEventListener('click',()=>decide(false));
   }
  }catch{
   placeholder.textContent='โหลดรายการไม่ได้ โปรดตรวจสอบการเชื่อมต่อหรือสิทธิ์ผู้จัดการ';
   list.replaceChildren(placeholder);
  }finally{button.disabled=false;}
 }
 button.addEventListener('click',load);
}
