/** Manager reviews original private fuel photos; no OCR is used. */
export function mountFuelReviewInbox({target,stationId,token}){
 if(!target)return;
 target.hidden=false;
 target.innerHTML=
  '<h3>ตรวจภาพหัวจ่ายและใบเสร็จ</h3>'+
  '<p class="hint">เปิดภาพจริงจาก Private Storage แล้วกรอกจำนวนลิตรและยอดเงินเอง ไม่ใช้ OCR</p>'+
  '<button type="button" id="load-fuel-reviews" class="button secondary">โหลดหลักฐานรอตรวจ</button>'+
  '<div id="fuel-review-cards" class="fuel-review-list"></div>';
 const button=target.querySelector('#load-fuel-reviews');
 const list=target.querySelector('#fuel-review-cards');
 const urls=new Set();
 function cleanup(){for(const u of urls)URL.revokeObjectURL(u);urls.clear();}
 window.addEventListener('pagehide',cleanup,{once:true});
 const request=async(uri,init={})=>{
  const response=await fetch(uri,{...init,cache:'no-store',headers:{
   authorization:'Bearer '+token,...(init.headers||{}),
  }});
  if(!response.ok)throw new Error('request_failed');
  return response.json();
 };
 function bahtToSatang(value){
  if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');
  const total=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  return total>0n?total.toString():null;
 }
 function satangToBaht(value){
  if(!/^(?:0|[1-9]\d{0,11})$/.test(value??''))return null;
  const total=BigInt(value);
  return (total/100n).toString()+'.'+(total%100n).toString().padStart(2,'0');
 }
 async function reload(){
  button.disabled=true;cleanup();list.replaceChildren();
  const empty=document.createElement('p');empty.textContent='กำลังโหลดภาพรอตรวจ…';list.appendChild(empty);
  try{
   const data=await request('/api/evidence/fuel/reviews?stationId='+encodeURIComponent(stationId));
   list.replaceChildren();
   if(!data.reviews?.length){
    empty.textContent='ไม่มีหลักฐานรอตรวจจากพนักงานคนอื่น';list.appendChild(empty);return;
   }
   for(const item of data.reviews){
    const row=document.createElement('article');row.className='fuel-review-card';
    const heading=document.createElement('strong');
    const pump=item.kind==='pump_display';
    heading.textContent=pump?'หน้าจอหัวจ่าย':'ใบเสร็จ';
    const img=document.createElement('img');
    img.alt=pump?'ภาพหน้าจอหัวจ่ายต้นฉบับ':'ภาพใบเสร็จต้นฉบับ';
     const liters=document.createElement('input');
    liters.type='text';liters.inputMode='decimal';liters.placeholder='จำนวนลิตรจากภาพ (เช่น 30.500)';
    liters.setAttribute('aria-label','ลิตรที่อ่านจากภาพจริง');
    const amount=document.createElement('input');
    amount.type='text';amount.inputMode='decimal';amount.placeholder='ยอดเงินจริงจากภาพ (บาท เช่น 1,000.50 โดยไม่ใส่คอมมา)';
    amount.setAttribute('aria-label','จำนวนเงินที่อ่านจากภาพจริง เป็นบาท');
    const approve=document.createElement('button');approve.type='button';
    approve.className='button primary';approve.textContent='ยืนยันจากภาพ';
    const reject=document.createElement('button');reject.type='button';
    reject.className='button secondary';reject.textContent='ปฏิเสธภาพ';
    const actions=document.createElement('div');actions.className='fuel-review-actions';
    actions.append(approve,reject);
    const message=document.createElement('p');message.setAttribute('role','status');
    approve.disabled=true;reject.disabled=true;
    row.append(heading,img);
    if(pump)row.append(liters);
    row.append(amount,actions,message);list.appendChild(row);
    const res=await fetch('/api/evidence/fuel/photo?evidenceId='+encodeURIComponent(item.evidenceId),{
      headers:{authorization:'Bearer '+token},cache:'no-store',
    }).catch(()=>null);
    if(!res?.ok){message.textContent='เปิดภาพไม่ได้ — ไม่สามารถอนุมัติ';continue;}
    const blob=await res.blob();
    if(!['image/jpeg','image/png'].includes(blob.type)){
      message.textContent='ชนิดไฟล์ไม่ถูกต้อง — ไม่สามารถอนุมัติ';continue;
    }
    const object=URL.createObjectURL(blob);
    urls.add(object);
    img.onload=()=>{approve.disabled=false;reject.disabled=false;};
    img.onerror=()=>{message.textContent='อ่านภาพไม่ได้ — ไม่สามารถอนุมัติ';};
    img.src=object;
    async function review(approved){
      const grossSatang=approved?bahtToSatang(amount.value.trim()):null;
      const amountLiters=approved&&pump?liters.value.trim():null;
      if(approved&&(!grossSatang||(pump&&!/^\d{1,7}(?:\.\d{1,3})?$/.test(amountLiters)))){
       message.textContent='กรอกจำนวนลิตรและยอดเงินให้ตรงกับภาพจริง';return;
      }
      approve.disabled=true;reject.disabled=true;
      try{
       await request('/api/evidence/fuel/review',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({evidenceId:item.evidenceId,approved,
          liters:amountLiters,grossSatang}),
       });
       message.textContent=approved?'ตรวจยืนยันแล้ว — ปิดยอดได้เมื่อทั้งสองหลักฐานผ่านและยอดตรงกัน':
         'ปฏิเสธภาพแล้ว';
       actions.replaceChildren();
      }catch{
       message.textContent='ตรวจสอบไม่สำเร็จ หรือผู้ตรวจเป็นผู้ถ่ายภาพเอง';
       approve.disabled=false;reject.disabled=false;
      }
    }
    approve.addEventListener('click',()=>review(true));
    reject.addEventListener('click',()=>review(false));
   }
  }catch{
   empty.textContent='โหลดคิวรอตรวจไม่ได้ กรุณาตรวจสอบสิทธิ์';
   list.replaceChildren(empty);
  }finally{button.disabled=false;}
 }
 button.addEventListener('click',reload);
}
