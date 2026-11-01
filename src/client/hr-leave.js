// HR leave workflow: request + independent review; no wage or attendance mutation.
const node=(tag,label,cls)=>{
 const el=document.createElement(tag);
 if(label!==undefined)el.textContent=label;
 if(cls)el.className=cls;
 return el;
};
const field=(name,type='text')=>{
 const wrap=node('label',name,'field'),input=node('input');
 input.type=type;wrap.append(input);return {wrap,input};
};
export async function mountHrLeave({target,token,stationId}){
 if(!target)return;
 target.replaceChildren();
 const title=node('h3','การลาและอนุมัติ · ไม่กระทบค่าจ้างอัตโนมัติ');
 const hint=node('p','ยื่นลา → ผู้มีสิทธิ์อีกบัญชีอนุมัติ → ฝ่ายบุคคลตรวจสิทธิ์วันลาและ Payroll แยกต่างหาก','hint');
 const form=node('form',undefined,'coupon-form');
 const eLabel=node('label','พนักงาน','field'),employee=node('select');employee.required=true;eLabel.append(employee);
 const tLabel=node('label','ประเภทการลา','field'),type=node('select');
 for(const [value,text] of [['annual','ลาพักร้อน'],['sick','ลาป่วย'],
  ['personal','ลากิจ'],['unpaid','ลาไม่รับค่าจ้าง (รอนโยบาย)']]){
  const o=node('option',text);o.value=value;type.append(o);
 }
 tLabel.append(type);
 const from=field('ตั้งแต่วันที่','date'),to=field('ถึงวันที่','date');
 from.input.required=true;to.input.required=true;
 const reason=field('หมายเหตุ (ไม่เกิน 500 ตัว)');reason.input.maxLength=500;
 const submit=node('button','ส่งคำขอลา','button primary');submit.type='submit';
 form.append(eLabel,tLabel,from.wrap,to.wrap,reason.wrap,submit);
 const list=node('div',undefined,'module-list');
 const status=node('p',undefined,'notice');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 target.append(title,hint,form,list,status);
 const say=(value,bad=false)=>{status.textContent=value;status.dataset.tone=bad?'error':'neutral';};
 const api=async(path,{method='GET',body}={})=>{
  const r=await fetch(path,{method,cache:'no-store',headers:{
   authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok){
   const code=(await r.json().catch(()=>({}))).error;
   throw new Error(code==='overlapping_leave'?'วันที่ลาทับซ้อนกับคำขอที่มีอยู่':
    code==='permission_denied'?'บัญชีนี้ไม่มีสิทธิ์อนุมัติคำขอของตนเอง':
    code==='invalid_leave'?'กรุณาตรวจวันที่หรือประเภทการลา':
    'ดำเนินการไม่ได้ (HTTP '+r.status+')');
  }
  return r.json();
 };
 const load=async()=>{
  list.replaceChildren();
  if(!employee.value)return;
  const {items}=await api('/api/hr/leave?employeeId='+encodeURIComponent(employee.value));
  if(!items?.length){list.append(node('p','ยังไม่มีคำขอลา'));return;}
  for(const item of items){
   const card=node('div',undefined,'module-item');
   const names={annual:'พักร้อน',sick:'ป่วย',personal:'กิจ',unpaid:'ไม่รับค่าจ้าง'};
   card.append(node('strong',(names[item.leaveType]||item.leaveType)+
    ' · '+item.startDate+' ถึง '+item.endDate+' · '+item.status),
    node('p','ยังไม่คำนวณค่าจ้าง/สิทธิ์วันลา หรือปรับกะอัตโนมัติ','hint'));
   if(item.reason)card.append(node('p',item.reason,'hint'));
   if(item.status==='pending'&&!item.requestedBySelf){
    const approve=node('button','อนุมัติคำขอ','button secondary');
    const reject=node('button','ไม่อนุมัติ','button secondary');
    for(const [button,yes] of [[approve,true],[reject,false]]){
     button.type='button';
     button.addEventListener('click',async()=>{
      button.disabled=true;
      try{const result=await api('/api/hr/leave/review',{method:'POST',
       body:{requestId:item.id,approved:yes}});
       if(result.deducted!==false)throw new Error('บันทึกเงินเดือนโดยไม่ผ่านการตรวจ');
       say(yes?'อนุมัติการลาแล้ว · ยังไม่หักหรือจ่ายค่าจ้าง':'ปฏิเสธคำขอลาแล้ว');
       await load();
      }catch(error){say(error.message,true);}finally{button.disabled=false;}
     });
    }
    card.append(approve,reject);
   }
   list.append(card);
  }
 };
 employee.addEventListener('change',()=>load().catch(e=>say(e.message,true)));
 form.addEventListener('submit',async event=>{
  event.preventDefault();submit.disabled=true;
  try{
   const r=await api('/api/hr/leave/request',{method:'POST',body:{
    employeeId:employee.value,leaveType:type.value,startDate:from.input.value,
    endDate:to.input.value,reason:reason.input.value}});
   if(r.deducted!==false)throw new Error('การยื่นลาไม่ควรมีผลหักค่าจ้าง');
   say('ส่งคำขอลาแล้ว · รอผู้มีสิทธิ์อีกบัญชีตรวจสอบ');
   reason.input.value='';await load();
  }catch(error){say(error.message,true);}finally{submit.disabled=false;}
 });
 try{
  const r=await api('/api/hr/roster?stationId='+encodeURIComponent(stationId));
  for(const e of r.roster?.employees||[]){
   const o=node('option',e.name+' ('+e.code+')');o.value=e.id;employee.append(o);
  }
  await load();
 }catch(error){say(error.message,true);}
}
