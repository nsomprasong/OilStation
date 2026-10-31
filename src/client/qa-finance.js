/** QA-only money simulation. Never describes test credit as an actual deposit. */
function baht(value){
 if(!/^[0-9]+$/.test(String(value??'')))return '—';
 const v=BigInt(value);return (v/100n).toLocaleString('th-TH')+'.'+
   (v%100n).toString().padStart(2,'0')+' บาท';
}
function satang(text){
 if(!/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?$/.test(text))return null;
 const [whole,decimal='']=text.split('.');
 const v=BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
 return v>=100n&&v<=5000000n?v.toString():null;
}
async function call(path,token,body){
 const r=await fetch(path,{method:body?'POST':'GET',cache:'no-store',
  headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));
 return {ok:r.ok,status:r.status,data};
}
export function mountQaTopupRequest({target,token,accounts,onChanged}){
 if(!target)return;
 target.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='เติมเงินจำลองเพื่อทดสอบ QR';
 const hint=document.createElement('p');hint.className='hint';
 hint.textContent='เงินทดสอบเท่านั้น ไม่มีการโอนเงินจริง ไม่ใช้สลิปธนาคาร ต้องให้ผู้มีสิทธิ์ของปั๊มอีกบัญชีหนึ่งอนุมัติก่อนยอดเพิ่ม';
 const form=document.createElement('form');form.className='coupon-form';
 const accountLabel=document.createElement('label');accountLabel.className='field';
 accountLabel.textContent='บัญชีบริษัท';
 const select=document.createElement('select');select.required=true;
 for(const a of accounts){
  const option=document.createElement('option');option.value=a.id;
  option.textContent=a.stationName+' · '+a.companyName;select.appendChild(option);
 }
 accountLabel.appendChild(select);
 const amountLabel=document.createElement('label');amountLabel.className='field';
 amountLabel.textContent='ยอดจำลอง (บาท สูงสุด 50,000 ต่อรายการ)';
 const amount=document.createElement('input');amount.required=true;amount.inputMode='decimal';
 amount.placeholder='เช่น 3000.00';amount.autocomplete='off';amountLabel.appendChild(amount);
 const send=document.createElement('button');send.type='submit';send.className='button primary';
 send.textContent='ส่งคำขอเติมเงินทดสอบ';
 const notice=document.createElement('p');notice.setAttribute('role','status');
 form.append(accountLabel,amountLabel,send,notice);
 target.append(heading,hint,form);
 let requestKey=null;
 select.addEventListener('change',()=>{requestKey=null;});
 amount.addEventListener('input',()=>{requestKey=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const amountSatang=satang(amount.value.trim());
  if(!select.value||!amountSatang){notice.textContent='กรอกเงิน 1 ถึง 50,000 บาท';return;}
  requestKey ||= crypto.randomUUID();
  send.disabled=true;notice.textContent='กำลังบันทึกคำขอ (ยังไม่เพิ่มยอด)…';
  try{
   const r=await call('/api/qa/finance/topup/request',token,{
     accountId:select.value,amountSatang,requestKey});
   if(!r.ok){notice.textContent='ส่งคำขอไม่ได้ ('+(r.data.error||'ไม่พร้อมใช้')+')';return;}
   notice.textContent='บันทึกคำขอทดสอบแล้ว รอเจ้าของปั๊มหรือผู้มีสิทธิ์อนุมัติ ยอดยังไม่เปลี่ยน';
   if(typeof onChanged==='function')await onChanged();
  }catch{notice.textContent='ไม่ทราบผลการส่ง โปรดตรวจสอบก่อนกดซ้ำ';}
  finally{send.disabled=false;}
 });
}
export function mountQaTopupApprovals({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const heading=document.createElement('h3');
 heading.textContent='อนุมัติเติมเงินจำลอง (QA)';
 const hint=document.createElement('p');hint.className='hint';
 hint.textContent='ต้องใช้บัญชีเจ้าของปั๊มหรือผู้มีสิทธิ์ที่ไม่ใช่ผู้ยื่นคำขอ ไม่มีการรับเงินธนาคารจริง';
 const refresh=document.createElement('button');refresh.type='button';
 refresh.className='button secondary';refresh.textContent='โหลดคำขอจำลอง';
 const list=document.createElement('div');list.className='module-list';
 target.append(heading,hint,refresh,list);
 async function reload(){
  refresh.disabled=true;list.replaceChildren();
  const state=document.createElement('p');state.textContent='กำลังโหลด…';list.appendChild(state);
  try{
   const r=await call('/api/qa/finance/topup/pending?stationId='+encodeURIComponent(stationId),token);
   if(!r.ok)throw Error('access_denied');
   list.replaceChildren();
   if(!r.data.requests?.length){
    state.textContent='ไม่มีคำขอจำลองรออนุมัติ';list.appendChild(state);return;
   }
   for(const item of r.data.requests){
    const card=document.createElement('article');card.className='module-item finance-item';
    const name=document.createElement('strong');name.textContent=item.companyName;
    const amt=document.createElement('div');amt.className='money';amt.textContent=baht(item.amountSatang);
    const note=document.createElement('p');
    note.textContent='คำขอ QA · '+new Date(item.requestedAt).toLocaleString('th-TH');
    const yes=document.createElement('button');yes.type='button';yes.className='button primary';
    yes.textContent='อนุมัติเพิ่มยอดทดสอบ';
    const no=document.createElement('button');no.type='button';no.className='button secondary';
    no.textContent='ปฏิเสธ';
    const status=document.createElement('p');status.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='finance-actions';actions.append(yes,no);
    card.append(name,amt,note,actions,status);list.appendChild(card);
    async function decide(approved){
     const msg=approved?'ยืนยันเพิ่มยอดจำลองในบัญชี QA เท่านั้น?':'ปฏิเสธคำขอจำลองนี้?';
     if(!window.confirm(msg))return;
     yes.disabled=true;no.disabled=true;status.textContent='กำลังตรวจสอบสิทธิ์และบันทึก…';
     try{
      const r=await call('/api/qa/finance/topup/review',token,{
        requestId:item.requestId,approved});
      if(!r.ok){status.textContent='ไม่สำเร็จ ('+(r.data.error||'ไม่มีสิทธิ์')+')';return;}
      status.textContent=approved?'เพิ่มยอดจำลองแล้ว':'ปฏิเสธแล้ว';
      await reload();
     }catch{status.textContent='ตรวจผลไม่สำเร็จ โปรดโหลดคิวอีกครั้ง';}
     finally{yes.disabled=false;no.disabled=false;}
    }
    yes.addEventListener('click',()=>decide(true));no.addEventListener('click',()=>decide(false));
   }
  }catch{state.textContent='โหลดคิว QA ไม่สำเร็จ หรือไม่มีสิทธิ์';list.replaceChildren(state);}
  finally{refresh.disabled=false;}
 }
 refresh.addEventListener('click',reload);reload();
}
