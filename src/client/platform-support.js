export function mountPlatformSupport({target,token}){
 if(!target)return;
 target.replaceChildren();
 const node=(tag,text,cls)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);return el;};
 const wrap=node('section',undefined,'os-support');
 const intro=node('p','อ่านได้เฉพาะสถานะปั๊มและเหตุการณ์ที่ได้รับอนุญาต ไม่มีสิทธิ์แก้ไขบัญชีหรือการเงิน','os-section-copy');
 const refresh=node('button','รีเฟรช','button secondary');refresh.type='button';
 const status=node('p','กำลังตรวจสอบสิทธิ์…','os-support-status');status.setAttribute('role','status');
 const label=node('h3','ปั๊มที่ตรวจสอบได้');
 const list=node('div',undefined,'module-list');
 const eventLabel=node('h3','เหตุการณ์ล่าสุด');
 const table=node('table',undefined,'os-activity-table');
 table.setAttribute('aria-label','ประวัติการดำเนินการที่ฝ่ายสนับสนุนดูได้');
 const thead=node('thead'),tr=node('tr');
 for(const h of ['ปั๊ม','เหตุการณ์','เวลา'])tr.append(node('th',h));
 thead.append(tr);
 const tbody=node('tbody');table.append(thead,tbody);
 wrap.append(intro,refresh,status,label,list,eventLabel,table);target.append(wrap);
 let busy=false;
 async function load(){
  if(busy)return;busy=true;refresh.disabled=true;status.textContent='กำลังโหลดข้อมูล…';
  try{
   const response=await fetch('/api/platform/support/overview',{
    cache:'no-store',headers:{authorization:'Bearer '+token}});
   if(!response.ok)throw Error('unavailable');
   const result=(await response.json()).result;
   if(result?.readOnly!==true||!Array.isArray(result.stations)||
      !Array.isArray(result.activity))throw Error('unavailable');
   list.replaceChildren();tbody.replaceChildren();
   for(const s of result.stations){
    const item=node('div',undefined,'module-item');
    item.append(node('strong',s.name),node('small',s.status||'—'));list.append(item);
   }
   if(!result.stations.length)list.append(node('p','ไม่มีปั๊มในขอบเขตที่อนุญาต'));
   for(const e of result.activity){
    const row=node('tr');
    const d=new Date(e.at);
    const time=Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('th-TH',{
      dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(d);
    for(const t of [e.station,e.action,time])row.append(node('td',t||'—'));
    tbody.append(row);
   }
   if(!result.activity.length){const row=node('tr'),cell=node('td','ยังไม่มีเหตุการณ์');
    cell.colSpan=3;row.append(cell);tbody.append(row);}
   status.textContent='แสดงปั๊ม '+result.stations.length+' แห่ง · อ่านอย่างเดียว';
  }catch{
   list.replaceChildren();tbody.replaceChildren();
   status.textContent='โหลดข้อมูลไม่ได้ กรุณาลองอีกครั้ง';
  }finally{busy=false;refresh.disabled=false;}
 }
 refresh.addEventListener('click',load);load();
}
