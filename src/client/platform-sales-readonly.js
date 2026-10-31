/** Read-only station/customer inspection and a compact three-column audit log. */
const node=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el;};
const btn=(text)=>{const b=node('button','button secondary',text);b.type='button';return b;};
const when=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(d);};
async function read(token,path){
 const response=await fetch('/api/platform/sales/'+path,{cache:'no-store',headers:{authorization:'Bearer '+token}});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'read_failed');
 return payload.result;
}
const message=(el,text)=>{el.textContent=text;};
const empty=(target,text)=>target.append(node('p','os-inspection-empty',text));
const statusText=v=>v==='active'?'ใช้งาน':v==='inactive'?'ไม่ใช้งาน':v==='pending'?'รอตรวจสอบ':String(v||'—');
export function mountSalesInspection({target,token}){
 target.replaceChildren();
 const region=node('section','os-inspection');
 region.hidden=true;
 const heading=node('div','os-inspection-header'),title=node('h4','','ตรวจสอบข้อมูลการดำเนินงาน');
 const back=btn('ย้อนกลับ');back.hidden=true;heading.append(title,back);
 const note=node('p','os-inspection-note','สิทธิ์อ่านอย่างเดียว · ไม่มีรายการยอดเงิน การชำระเงิน หรือปุ่มแก้ไขข้อมูล');
 const status=node('p','os-inspection-status');status.setAttribute('role','status');
 const content=node('div','os-inspection-content');
 region.append(heading,note,status,content);target.append(region);
 let stationId=null,companyId=null,epoch=0;
 async function show(station,company=null){
  stationId=station;companyId=company;
  const current=++epoch;region.hidden=false;back.hidden=!company;
  content.replaceChildren();message(status,'กำลังโหลดข้อมูลที่ได้รับสิทธิ์…');
  try{
   const params=new URLSearchParams({stationId:station});
   if(company)params.set('companyId',company);
   const data=await read(token,'inspection?'+params);
   if(current!==epoch)return;
   if(company){
    title.textContent='ลูกค้าบริษัท · '+(data.company?.name||'');
    const detail=node('div','os-inspection-summary');
    detail.append(node('strong','',data.company?.name||'ลูกค้าบริษัท'),
      node('span','','สถานะ: '+statusText(data.company?.status)));
    content.append(detail,node('h5','','รถที่ลงทะเบียนกับบริษัท'));
    const vehicles=data.vehicles||[];
    if(!vehicles.length)empty(content,'ยังไม่มีรถที่ลงทะเบียน');
    const list=node('div','os-inspection-list');
    for(const v of vehicles){
     const item=node('div','os-inspection-item');
     item.append(node('strong','',v.plate||'ไม่ระบุทะเบียน'),
       node('span','',v.province||'—'),node('small','',v.active?'ใช้งาน':'ไม่ใช้งาน'));
     list.append(item);
    }
    content.append(list);
   }else{
    title.textContent='ตรวจสอบปั๊ม · '+(data.station?.name||'');
    const overview=node('div','os-inspection-summary');
    overview.append(node('strong','',data.station?.name||'ปั๊มน้ำมัน'),
     node('span','',data.station?.organization||''),
     node('span','','สถานะ: '+statusText(data.station?.status)),
     node('small','',data.station?.address||''));
    content.append(overview,node('h5','','บริษัทลูกค้าของปั๊ม'));
    const companies=data.companies||[];
    if(!companies.length)empty(content,'ยังไม่มีบริษัทลูกค้าที่ผูกกับปั๊มนี้');
    const list=node('div','os-inspection-list');
    for(const c of companies){
     const item=node('div','os-inspection-item');
     const info=node('div');
     info.append(node('strong','',c.name||'บริษัทลูกค้า'),
       node('span','','สถานะ: '+statusText(c.status)),
       node('small','','รถ '+c.vehicles+' คัน · ใช้งาน '+c.activeVehicles+' คัน · คนขับ '+c.drivers+' คน'));
     const open=btn('ดูข้อมูลลูกค้า');open.setAttribute('aria-label','ดูข้อมูลลูกค้า '+(c.name||''));
     open.addEventListener('click',()=>show(station,c.id));
     item.append(info,open);list.append(item);
    }
    content.append(list);
   }
   message(status,'');
   region.scrollIntoView?.({block:'start',behavior:'smooth'});
  }catch(e){if(current===epoch)message(status,e.message==='permission_denied'?
    'คุณไม่มีสิทธิ์เข้าถึงข้อมูลปั๊มหรือบริษัทนี้':'โหลดข้อมูลไม่ได้ กรุณาลองอีกครั้ง');}
 }
 back.addEventListener('click',()=>{if(stationId)show(stationId);});
 return {openStation:id=>show(id),close:()=>{epoch++;region.hidden=true;},element:region};
}
export function mountSalesActivity({target,token}){
 if(!target)return;
 target.replaceChildren();
 const wrapper=node('section','os-activity');
 const header=node('div','os-activity-header');
 header.append(node('h3','','ประวัติการดำเนินการ'),
   node('p','','ดูว่าใครทำอะไร เวลาไหน · แสดงเฉพาะปั๊มที่คุณมีสิทธิ์ตรวจสอบ'));
 const toolbar=node('div','os-activity-tools');
 const label=node('label','','เลือกปั๊ม');
 const station=node('select');station.setAttribute('aria-label','เลือกปั๊มสำหรับประวัติการดำเนินการ');
 label.append(station);
 const refresh=btn('รีเฟรช');toolbar.append(label,refresh);
 const status=node('p','os-activity-status');status.setAttribute('role','status');
 const tableWrap=node('div','os-activity-table-wrap');
 const table=node('table','os-activity-table');
 table.setAttribute('aria-label','ประวัติการดำเนินการของปั๊ม');
 const thead=node('thead'),tr=node('tr');
 for(const text of ['ใคร','ทำอะไร','เมื่อไร'])tr.append(node('th','',text));
 thead.append(tr);const tbody=node('tbody');
 table.append(thead,tbody);tableWrap.append(table);
 const more=btn('ดูรายการก่อนหน้า');more.hidden=true;
 wrapper.append(header,toolbar,status,tableWrap,more);target.append(wrapper);
 let before=null,loading=false;
 const append=events=>{
  for(const item of events){
   const row=node('tr');
   row.append(node('td','',item.who||'ผู้ใช้งานระบบ'),
    node('td','',item.what||'ดำเนินการ'),
    node('td','',when(item.at)));
   tbody.append(row);
  }
 };
 async function fetchEvents(reset=true){
  if(loading||!station.value)return;
  loading=true;refresh.disabled=true;more.disabled=true;
  if(reset){before=null;tbody.replaceChildren();}
  message(status,'กำลังโหลดประวัติ…');
  try{
   const qs=new URLSearchParams({stationId:station.value});
   if(before)qs.set('before',before);
   const data=await read(token,'activity?'+qs);
   const events=Array.isArray(data.events)?data.events:[];
   append(events);
   if(events.length)before=events[events.length-1].at;
   more.hidden=events.length<50;
   message(status,tbody.childElementCount? 'แสดง '+tbody.childElementCount+' รายการ':'ยังไม่มีประวัติการดำเนินการที่แสดงได้');
  }catch{message(status,'โหลดประวัติไม่สำเร็จ กรุณากดรีเฟรช');}
  finally{loading=false;refresh.disabled=false;more.disabled=false;}
 }
 async function init(){
  message(status,'กำลังตรวจสอบสิทธิ์และรายชื่อปั๊ม…');
  try{
   const data=await read(token,'workspace');
   const items=data.isAdmin?(data.stations||[]):
    (data.assignments||[]).filter(a=>a.isCurrent).map(a=>({id:a.stationId,name:a.stationName,organization:a.organization}));
   const unique=[...new Map(items.map(s=>[s.id,s])).values()];
   station.replaceChildren();
   for(const s of unique){const opt=node('option','',(s.organization?s.organization+' · ':'')+s.name);
    opt.value=s.id;station.append(opt);}
   if(!unique.length){message(status,'ยังไม่มีปั๊มที่มีสิทธิ์ดูประวัติ');tableWrap.hidden=true;return;}
   await fetchEvents();
  }catch{message(status,'ไม่สามารถโหลดสิทธิ์เข้าดูประวัติได้');}
 }
 station.addEventListener('change',()=>{more.hidden=true;fetchEvents();});
 refresh.addEventListener('click',()=>fetchEvents());
 more.addEventListener('click',()=>fetchEvents(false));
 init();
 return {refresh:()=>fetchEvents()};
}
