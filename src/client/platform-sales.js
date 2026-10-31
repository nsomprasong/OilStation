import {mountSalesInspection} from './platform-sales-readonly.js';
/** Sales dashboard. Authorization always enforced by Worker + SQL. */
const make=(tag,cls='',content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n};
const dateTime=value=>value?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value)):'—';
const baht=v=>{if(!/^-?\d{1,16}$/.test(String(v??'')))return '—';const n=BigInt(v),abs=n<0n?-n:n;return (n<0n?'-':'')+(abs/100n).toLocaleString('th-TH')+'.'+String(abs%100n).padStart(2,'0')+' บาท';};
const addText=(node,text)=>node.append(make('p','os-sales-secondary',text));
export function mountPlatformSales({target,token,inviteControl}){
 if(!target)return;
 target.replaceChildren();
 const root=make('div','os-sales-workspace');
 const head=make('div','os-sales-head');
 head.append(make('h3','ทีมขายและการดูแลลูกค้า'),
  make('p','ดูปั๊มที่ดูแล รายงานค่าคอมมิชชั่นที่บันทึกไว้ และประวัติการโอนงาน'));
 const reload=make('button','button secondary','รีเฟรช');reload.type='button';head.append(reload);root.append(head);
 const status=make('p','os-sales-status');status.setAttribute('role','status');root.append(status);
 const inviteArea=make('section','os-sales-panel');inviteArea.append(make('h4','','เชิญเซลล์เข้าสู่ระบบ'));
 const team=make('section','os-sales-panel'),assignment=make('section','os-sales-panel');
 const transfer=make('section','os-sales-panel'),commission=make('section','os-sales-panel');
 const collected=make('section','os-sales-panel');
 const history=make('section','os-sales-panel');
 const inspectionPanel=make('section','os-sales-panel');
 inspectionPanel.hidden=true;
 const title=(node,title)=>node.append(make('h4','',title));
 title(team,'ทีมขาย');title(assignment,'ปั๊มที่รับผิดชอบ');
 title(transfer,'ย้ายการดูแลปั๊ม');title(collected,'ลูกค้าที่ชำระค่าบริการแล้ว');
 title(commission,'รายงานค่าคอมมิชชั่น');title(history,'ประวัติการดูแล');
 addText(collected,'แสดงเฉพาะลูกค้าที่มีใบแจ้งหนี้ชำระแล้วและมีรายการค่าคอมมิชชั่นที่ผูกกับเซลล์');
 const summary=make('p','os-sales-secondary','แสดงยอดตามข้อมูลที่บันทึกจริง ไม่ใช่ยอดอนุมัติจ่าย');
 commission.append(summary);
 const teamList=make('div','os-sales-grid'),careList=make('div','os-sales-grid');
 const moneyList=make('div','os-sales-grid'),historyList=make('div','os-sales-grid');
 const collectedList=make('div','os-sales-grid');collected.append(collectedList);
 team.append(teamList);assignment.append(careList);commission.append(moneyList);history.append(historyList);
 const form=make('form','os-sales-transfer');
 const stationLabel=make('label','','ปั๊มที่ต้องการย้าย');const station=make('select');station.name='station';station.required=true;stationLabel.append(station);
 const salesLabel=make('label','','เซลล์ผู้รับผิดชอบใหม่');const sales=make('select');sales.name='sales';sales.required=true;salesLabel.append(sales);
 const reasonLabel=make('label','','เหตุผลการย้ายงาน');const reason=make('textarea');reason.required=true;reason.minLength=5;reason.maxLength=300;reason.rows=2;reason.placeholder='เช่น เปลี่ยนเขตการดูแลตามแผนทีมขาย';reasonLabel.append(reason);
 const transferHint=make('p','os-sales-secondary','การเปลี่ยนผู้ดูแลมีผลเที่ยงคืนวันถัดไปตามเวลาของปั๊ม ไม่แก้ค่าคอมมิชชั่นย้อนหลัง');
 const save=make('button','button primary','ยืนยันการย้ายการดูแล');save.type='submit';
 const outcome=make('p','os-sales-status');outcome.setAttribute('role','status');
 form.append(stationLabel,salesLabel,reasonLabel,transferHint,save,outcome);transfer.append(form);
 root.append(inviteArea,team,assignment,transfer,inspectionPanel,collected,commission,history);target.append(root);
 const inspection=mountSalesInspection({target:inspectionPanel,token});
 let data=null,busy=false;
 const card=(title,details=[])=>{
  const node=make('article','os-sales-card');node.append(make('strong','',title));
  for(const detail of details)node.append(make('p','',detail));
  return node;
 };
 const empty=(node,text)=>{node.replaceChildren();addText(node,text)};
 const options=(select,items,placeholder)=>{
  select.replaceChildren();const first=make('option','',placeholder);first.value='';select.append(first);
  for(const [id,name] of items){const opt=make('option','',name);opt.value=id;select.append(opt);}
 };
 async function load(){
  if(busy)return;
  reload.disabled=true;status.textContent='กำลังโหลดข้อมูลทีมขาย…';
  try{
   const response=await fetch('/api/platform/sales/workspace',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||'unknown');
   data=payload.result;
   const isAdmin=data.isAdmin===true;
   inviteArea.hidden=!isAdmin;transfer.hidden=!isAdmin;
   teamList.replaceChildren();careList.replaceChildren();moneyList.replaceChildren();historyList.replaceChildren();collectedList.replaceChildren();
   const people=data.people||[], assignments=data.assignments||[],money=data.commissions||[];
   if(!people.length)empty(teamList,isAdmin?'ยังไม่มีเซลล์ที่ยืนยันคำเชิญ':'ยังไม่มีข้อมูลบัญชีเซลล์');
   for(const p of people){
    const active=assignments.filter(a=>a.salesId===p.id&&a.isCurrent).length;
    const upcoming=assignments.filter(a=>a.salesId===p.id&&a.isUpcoming).length;
    teamList.append(card(p.name||p.email||'เซลล์',[p.email||'','ดูแลอยู่ '+active+' ปั๊ม · กำลังจะรับ '+upcoming+' ปั๊ม']));
   }
   if(!assignments.some(a=>a.isCurrent||a.isUpcoming))empty(careList,'ยังไม่มีปั๊มที่มอบหมายให้เซลล์');
   for(const a of assignments.filter(a=>a.isCurrent||a.isUpcoming)){
    const c=card(a.stationName||'ปั๊ม',[a.organization||'',
     'เซลล์: '+(a.salesName||'—'),'สถานะ: '+(a.isUpcoming?'กำหนดเริ่มในอนาคต':'กำลังดูแล'),
     'เริ่ม: '+dateTime(a.effectiveFrom)]);
    if(a.isCurrent){
      const open=make('button','button secondary','เปิดหน้าปั๊ม');
      open.type='button';open.setAttribute('aria-label','ตรวจสอบปั๊ม '+a.stationName);
      open.addEventListener('click',()=>{inspectionPanel.hidden=false;inspection.openStation(a.stationId);
       target.closest('[data-ws-screen]')?.dispatchEvent(new CustomEvent('oilstation:open-pane',
        {bubbles:true,detail:{key:'inspection'}}));});
      c.append(open);
    }
    careList.append(c);
   }
   if(isAdmin&&Array.isArray(data.stations)){
    const known=new Set(assignments.filter(a=>a.isCurrent).map(a=>a.stationId));
    for(const s of data.stations.filter(s=>!known.has(s.id))){
     const c=card(s.name||'ปั๊ม',[s.organization||'','ข้อมูลการดำเนินงาน · ดูอย่างเดียว']);
     const open=make('button','button secondary','เปิดหน้าปั๊ม');
     open.type='button';open.addEventListener('click',()=>{inspectionPanel.hidden=false;inspection.openStation(s.id);
      target.closest('[data-ws-screen]')?.dispatchEvent(new CustomEvent('oilstation:open-pane',
       {bubbles:true,detail:{key:'inspection'}}));});
     c.append(open);careList.append(c);
    }
   }
   const sold=data.collectedCustomers||[];
   if(!sold.length)empty(collectedList,'ยังไม่มีลูกค้าที่มีหลักฐานชำระและรายการค่าคอมมิชชั่นเชื่อมโยง');
   for(const c of sold)collectedList.append(card(c.stationName||'ปั๊ม',
    [c.organization||'', 'จำนวนใบแจ้งหนี้ชำระแล้ว: '+c.paidInvoices,
     isAdmin?'เซลล์ ID: '+c.salesId:'']));
   if(!money.length)empty(moneyList,'ยังไม่มีรายการค่าคอมมิชชั่นที่บันทึกไว้');
   for(const m of money)moneyList.append(card(m.stationName||'ปั๊ม',
    ['สิทธิค่าคอมมิชชั่นที่บันทึก: '+baht(m.entitlementSatang),
     'ยอดรายการในบัญชีค่าคอมมิชชั่น: '+baht(m.recordedLedgerSatang),
     'จำนวนรายการสิทธิ: '+m.entitlementCount,
     isAdmin?'เซลล์ ID: '+m.salesId:'']));
   if(!assignments.length)empty(historyList,'ยังไม่มีประวัติการมอบหมาย');
   for(const a of assignments)historyList.append(card(a.stationName||'ปั๊ม',
    ['ผู้ดูแล: '+(a.salesName||'—'),'เริ่ม: '+dateTime(a.effectiveFrom),
     'สิ้นสุด: '+(a.effectiveUntil?dateTime(a.effectiveUntil):'ยังไม่กำหนด')]));
   if(isAdmin){
    options(station,(data.stations||[]).map(s=>[s.id,(s.organization||'')+' / '+s.name]),'เลือกปั๊ม');
    options(sales,people.map(p=>[p.id,p.name||p.email||p.id]),'เลือกเซลล์');
    const pending=data.pendingInvitations||[];
    if(!inviteArea.dataset.initialized){
     inviteArea.dataset.initialized='true';
     if(inviteControl)inviteArea.append(inviteControl());
    }
    const pendingLine=inviteArea.querySelector('[data-sales-pending]')||make('p','os-sales-secondary');
    pendingLine.dataset.salesPending='true';
    pendingLine.textContent=pending.length?'คำเชิญที่รอตอบรับ: '+pending.map(p=>p.email).join(', '):
      'ไม่มีคำเชิญค้างอยู่';
    if(!pendingLine.isConnected)inviteArea.append(pendingLine);
   }
   status.textContent=isAdmin?'แสดงข้อมูลทีมขายทั้งหมด':'แสดงเฉพาะข้อมูลที่คุณมีสิทธิ์ดู';
  }catch{status.textContent='โหลดข้อมูลไม่ได้ กรุณากดรีเฟรช';}
  finally{reload.disabled=false;}
 }
 reload.addEventListener('click',load);
 const confirmation=make('dialog','os-sales-confirm');
 const confirmTitle=make('h3','','ยืนยันการย้ายความรับผิดชอบ');
 confirmTitle.id='sales-confirm-title';confirmation.setAttribute('aria-labelledby',confirmTitle.id);
 const confirmText=make('p');const confirmActions=make('div','os-sales-confirm-actions');
 const dismiss=make('button','button secondary','ยกเลิก');dismiss.type='button';
 const approve=make('button','button primary','ยืนยันการย้าย');approve.type='button';
 confirmActions.append(dismiss,approve);confirmation.append(confirmTitle,confirmText,confirmActions);
 root.append(confirmation);dismiss.addEventListener('click',()=>confirmation.close());
 let pendingTransfer=null;
 form.addEventListener('submit',event=>{
  event.preventDefault();if(busy||!data?.isAdmin)return;
  if(!station.value||!sales.value||reason.value.trim().length<5){
   outcome.textContent='เลือกปั๊ม เซลล์ และกรอกเหตุผลอย่างน้อย 5 ตัวอักษร';return;
  }
  pendingTransfer={stationId:station.value,salesUserId:sales.value,reason:reason.value.trim()};
  confirmText.textContent='ย้ายปั๊ม “'+station.selectedOptions[0].textContent+
   '” ให้เซลล์ “'+sales.selectedOptions[0].textContent+
   '” มีผลเที่ยงคืนวันถัดไปตามเวลาของปั๊ม โดยไม่แก้ประวัติค่าคอมมิชชั่นเดิม ยืนยันหรือไม่?';
  confirmation.showModal();dismiss.focus();
 });
 approve.addEventListener('click',async()=>{
  if(busy||!pendingTransfer||!data?.isAdmin)return;
  busy=true;approve.disabled=true;save.disabled=true;
  confirmation.close();outcome.textContent='กำลังบันทึกคำขอโอนงาน…';
  try{
   const res=await fetch('/api/platform/sales/transfer',{method:'POST',headers:{
    authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(pendingTransfer)});
   const payload=await res.json().catch(()=>({}));
   if(!res.ok){
    outcome.textContent=payload.error==='transfer_already_scheduled'?
     'ปั๊มนี้มีการย้ายงานที่ตั้งเวลาไว้แล้ว โปรดตรวจสอบประวัติก่อน':
     'โอนงานไม่สำเร็จ กรุณาตรวจสอบสิทธิ์หรือข้อมูล';return;
   }
   reason.value='';outcome.textContent='ตั้งเวลาย้ายงานสำเร็จ มีผลวันที่ '+dateTime(payload.result.effectiveFrom);
  }catch{outcome.textContent='เชื่อมต่อไม่ได้ กรุณาตรวจสอบรายการก่อนกดซ้ำ';}
  finally{pendingTransfer=null;busy=false;approve.disabled=false;save.disabled=false;await load();}
 });
 load();
 return {reload:load};
}
