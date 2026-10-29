/**
 * Authenticated, photo-first manager review inbox; untrusted OCR text never
 * substitutes for the actual private image.
 */
export function mountPlateReviewInbox({target,token,stationId}){
 if(!target)return;
 target.hidden=false;
 target.innerHTML=
 '<h3>รายการทะเบียนรอตรวจโดยผู้จัดการ</h3>'+
 '<p class="hint">ตรวจภาพต้นฉบับจากพนักงานคนอื่นก่อนอนุมัติ หากทะเบียนไม่ตรงคูปองต้องออกคูปองใหม่</p>'+
 '<button id="load-pending-plates" class="button secondary" type="button">โหลดรายการรอตรวจ</button>'+
 '<div id="pending-plate-reviews" class="plate-review-cards"></div>';
 const button=target.querySelector('#load-pending-plates');
 const list=target.querySelector('#pending-plate-reviews');
 const photoUrls=new Set();
 const revoke=()=>{for(const url of photoUrls)URL.revokeObjectURL(url);photoUrls.clear();};
 window.addEventListener('pagehide',revoke,{once:true});
 const auth={authorization:'Bearer '+token};
 const json=async(url,init={})=>{
  const response=await fetch(url,{...init,headers:{...auth,...(init.headers||{})},cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||'request_failed');
  return payload;
 };
 async function reload(){
  button.disabled=true;revoke();list.replaceChildren();
  const placeholder=document.createElement('p');
  placeholder.textContent='กำลังโหลดรายการที่รอตรวจ…';list.appendChild(placeholder);
  try{
   const data=await json('/api/evidence/plate/reviews?stationId='+encodeURIComponent(stationId));
   list.replaceChildren();
   if(!data.reviews?.length){
    placeholder.textContent='ไม่มีรายการรอตรวจจากพนักงานคนอื่น';
    list.appendChild(placeholder);return;
   }
   for(const record of data.reviews){
    const card=document.createElement('article');card.className='plate-review-card';
    const title=document.createElement('strong');
    title.textContent='ทะเบียนในคูปอง: '+(record.expectedPlate||'ไม่ผูกทะเบียน');
    const photo=document.createElement('img');
    photo.alt='ภาพทะเบียนจริงสำหรับผู้จัดการตรวจ';
    const input=document.createElement('input');
    input.type='text';input.maxLength=40;
    input.placeholder='ทะเบียนที่เห็นจากภาพจริง';
    input.setAttribute('aria-label','ทะเบียนที่เห็นจากภาพจริง');
    const approve=document.createElement('button');
    approve.type='button';approve.className='button primary';approve.textContent='ตรงกัน — อนุมัติ';
    const reject=document.createElement('button');
    reject.type='button';reject.className='button secondary';reject.textContent='ปฏิเสธภาพ';
    const message=document.createElement('p');message.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='plate-review-actions';
    actions.append(approve,reject);
    approve.disabled=true;reject.disabled=true;
    card.append(title,photo,input,actions,message);list.appendChild(card);
    const response=await fetch('/api/evidence/plate/photo?photoId='+encodeURIComponent(record.photoId),
      {headers:auth,cache:'no-store'}).catch(()=>null);
    if(!response?.ok){
      message.textContent='เปิดภาพไม่ได้ — ไม่อนุญาตให้อนุมัติ';continue;
    }
    const blob=await response.blob();
    if(!['image/png','image/jpeg'].includes(blob.type)){
      message.textContent='ไฟล์ภาพไม่ถูกต้อง';continue;
    }
    const objectUrl=URL.createObjectURL(blob);
    photoUrls.add(objectUrl);
    photo.onload=()=>{approve.disabled=false;reject.disabled=false;};
    photo.onerror=()=>{
      approve.disabled=true;reject.disabled=true;
      message.textContent='อ่านภาพไม่ได้ — ห้ามอนุมัติ';
    };
    photo.src=objectUrl;
    async function review(approved){
      if(approved&&!input.value.trim()){
        message.textContent='กรุณากรอกทะเบียนจากภาพจริง';return;
      }
      approve.disabled=true;reject.disabled=true;
      try{
       await json('/api/evidence/plate/review',{method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({photoId:record.photoId,approved,
          observedPlate:input.value.trim()})});
       message.textContent=approved?'ยืนยันจากภาพจริงเรียบร้อย':'ปฏิเสธภาพนี้แล้ว';
       actions.replaceChildren();
      }catch(e){
       message.textContent=String(e.message)==='plate_mismatch'?
         'ทะเบียนไม่ตรงคูปอง ต้องให้บริษัทออกใบใหม่':
         'ตรวจสอบไม่สำเร็จ หรือไม่มีสิทธิ์อนุมัติภาพของตัวเอง';
       approve.disabled=false;reject.disabled=false;
      }
    }
    approve.addEventListener('click',()=>review(true));
    reject.addEventListener('click',()=>review(false));
   }
  }catch{
   placeholder.textContent='โหลดรายการไม่ได้ กรุณาตรวจสิทธิ์หรือเครือข่าย';
   list.replaceChildren(placeholder);
  }finally{button.disabled=false;}
 }
 button.addEventListener('click',reload);
}
