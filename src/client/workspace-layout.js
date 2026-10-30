export function selectWorkspaceScreens(memberships=[]){
 const has=(scope,roles)=>memberships.some(m=>m.scopeType===scope&&roles.includes(m.role));
 const p=has('platform',['platform_superadmin']);
 const b=memberships.some(m=>m.scopeType==='organization'&&m.organizationId&&['organization_owner','owner','manager','billing_manager'].includes(m.role));
 const s=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager'].includes(m.role));
 const pump=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager','cashier','attendant','pump_staff'].includes(m.role));
 const attendance=memberships.some(m=>m.scopeType==='station'&&m.stationId);
 const review=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager','hr_manager'].includes(m.role));
 const corp=memberships.some(m=>m.scopeType==='corporate_company');
 const invite=memberships.some(m=>m.scopeType==='corporate_company'&&m.corporateCompanyId&&m.role==='corporate_admin');
 return [
  {key:'overview',label:'ภาพรวม',icon:'layout-dashboard',desc:'สิทธิ์และทางลัด',ids:[],yes:true},
  {key:'stations',label:'จัดการปั๊มน้ำมัน',icon:'building-2',desc:'สร้างปั๊ม เลือกแบรนด์และเปิดโมดูล',ids:['platform-workspace'],yes:p},
  {key:'plan',label:'แพ็กเกจและชำระเงิน',icon:'credit-card',desc:'เลือกแพ็กเกจและวิธีชำระเงิน',
    ids:['station-saas-plan-workspace'],
    yes:memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner'].includes(m.role))},
  {key:'billing',label:p?'แพ็กเกจและ VAT':'ค่าบริการ',icon:'receipt',desc:p?'กำหนด VAT และแพ็กเกจให้ลูกค้าเลือก':'ดูและชำระค่าบริการ',ids:[...(p?['platform-saas-billing']:[]),...(b?['saas-billing-workspace']:[])],yes:p||b},
  {key:'fuel',label:'ชนิดและราคาน้ำมัน',icon:'fuel',desc:'กำหนดสินค้าและราคาหน้าปั๊ม',ids:['station-fuel-workspace'],yes:s},
  {key:'pump',label:'งานหน้าลาน',icon:'scan-line',desc:'จัดการคูปองและรายการเติมน้ำมัน',ids:['station-pump-workspace'],yes:pump},
  {key:'customers',label:'ลูกค้าบริษัท',icon:'building',desc:'บัญชีลูกค้าและวงเงิน',ids:['station-customers-workspace'],yes:s},
  {key:'finance',label:'การเงิน',icon:'wallet',desc:'รับเงินและตรวจสอบหลักฐาน',ids:['station-finance-workspace'],yes:s},
  {key:'hr',label:'พนักงานและกะ',icon:'users',desc:'บริหารพนักงานและตารางกะ',ids:['hr-workspace'],yes:s},
  {key:'attendance',label:'ลงเวลา',icon:'clock-3',desc:'ลงเวลาทำงาน',ids:['attendance-workspace'],yes:attendance},
  {key:'reviews',label:'อนุมัติลงเวลา',icon:'clipboard-check',desc:'ตรวจรายการลงเวลา',ids:['attendance-review-workspace'],yes:review},
  {key:'payroll',label:'สรุปเงินเดือน',icon:'file-spreadsheet',desc:'ตรวจข้อมูลเตรียมจ่าย',ids:['attendance-payroll-preview-workspace'],yes:review},
  {key:'corporate',label:'บัญชีบริษัท',icon:'ticket',desc:'คูปองและประวัติใช้วงเงิน',ids:['corporate-workspace'],yes:corp},
  {key:'invitations',label:'เชิญสมาชิก',icon:'user-plus',desc:'เชิญและกำหนดสิทธิ์',ids:['member-invites'],yes:s||invite}
 ].filter(x=>x.yes);
}

export function renderWorkspaceShell(screens){
 const buttons=screens.map((s,i)=>`<button type="button" class="ws-nav${i===0?' active':''}" data-ws-go="${s.key}" aria-controls="ws-${s.key}" ${i===0?'aria-current="page"':''}><i data-ui-icon="${s.icon}"></i><span>${s.label}</span></button>`).join('');
 const quick=screens.filter(x=>x.key!=='overview').slice(0,4).map(s=>`<button class="ws-quick" type="button" data-ws-go="${s.key}"><strong>${s.label}</strong><small>${s.desc}</small></button>`).join('');
 const panels=screens.map((s,i)=>`<section class="panel ws-screen" data-ws-screen="${s.key}" id="ws-${s.key}" ${i===0?'':'hidden'}>
  <div class="ws-screen-head"><span class="eyebrow">OilStation / ${s.label}</span><h2 tabindex="-1">${s.key==='overview'?'เริ่มต้นทำงาน':s.label}</h2><p>${s.key==='overview'?'เลือกงานจากทางลัดหรือเมนูด้านข้าง':s.desc}</p></div>
  ${s.key==='overview'?`<div class="section-title"><span class="status-dot"></span>สิทธิ์ของคุณ</div><div class="scope-list" id="scopes"></div>
   <div class="ws-overview-columns"><div><h3>งานที่ทำได้</h3><div class="ws-quick-grid">${quick||'<p>ยังไม่มีโมดูลที่เปิดใช้งาน</p>'}</div></div>
   <div><h3>โมดูลตามสิทธิ์</h3><div class="module-list" id="modules"></div></div></div>`:
   s.ids.map(id=>`<div class="ws-widget" id="${id}"></div>`).join('')}
 </section>`).join('');
 return `<div class="ws-layout" data-workspace-shell>
 <aside class="ws-sidebar" aria-label="เมนูพื้นที่ทำงาน"><div class="ws-side-head"><strong>OilStation</strong><small>WORKSPACE</small></div>
 <nav class="ws-nav-list" aria-label="เมนูหลัก">${buttons}</nav>
 <button class="ws-signout" id="logout" type="button"><i data-ui-icon="log-out"></i>ออกจากระบบ</button></aside>
 <div class="ws-main"><header class="ws-header"><div><p class="eyebrow">OILSTATION WORKSPACE</p><h1 id="scope-title"></h1><p>พื้นที่บริหารจัดการตามสิทธิ์ของคุณ</p></div><span class="ws-current" id="ws-current">ภาพรวม</span></header>${panels}</div></div>`;
}

export function wireWorkspaceNavigation(root){
 const views=[...root.querySelectorAll('[data-ws-screen]')],links=[...root.querySelectorAll('[data-ws-go]')];
 for(const link of links)link.addEventListener('click',()=>{
  const key=link.dataset.wsGo,view=views.find(x=>x.dataset.wsScreen===key);
  if(!view)return;
  for(const v of views)v.hidden=v!==view;
  for(const button of links){
   const selected=button.dataset.wsGo===key;
   button.classList.toggle('active',selected);
   if(button.closest('nav')&&selected)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  }
  const heading=view.querySelector('h2');
  const current=root.querySelector('#ws-current');if(current)current.textContent=heading?.textContent||'';
  heading?.focus({preventScroll:true});
  root.scrollIntoView({block:'start',behavior:'auto'});
 });
}
