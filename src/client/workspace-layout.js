import {renderMobileHome,renderMobileNav} from './mobile-home.js';
import {renderLogoutDialog,wireLogoutDialog} from './logout-dialog.js';
import {readNavUsage,saveNavUsage,incrementNavUsage} from './nav-preferences.js';
import {decorateIcons} from './icons.js';
import {renderWorkspaceCategories} from './workspace-categories.js';

export function selectWorkspaceScreens(memberships=[]){
 const has=(scope,roles)=>memberships.some(m=>m.scopeType===scope&&roles.includes(m.role));
 const p=has('platform',['platform_superadmin']);
 const sales=has('platform',['platform_sales']);
 const support=has('platform',['platform_support']);
 const b=memberships.some(m=>m.scopeType==='organization'&&m.organizationId&&['organization_owner','owner','manager','billing_manager'].includes(m.role));
 const s=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager'].includes(m.role));
 const pump=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager','cashier','attendant','pump_staff'].includes(m.role));
 const attendance=memberships.some(m=>m.scopeType==='station'&&m.stationId);
 const review=memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner','manager','hr_manager'].includes(m.role));
 const corp=memberships.some(m=>m.scopeType==='corporate_company');
 const invite=memberships.some(m=>m.scopeType==='corporate_company'&&m.corporateCompanyId&&m.role==='corporate_admin');
 return [
  {key:'overview',label:'ภาพรวม',icon:'clipboard',desc:'สิทธิ์และทางลัด',ids:[],yes:true},
  {key:'support',label:'งานฝ่ายสนับสนุน',icon:'clipboard',desc:'สถานะและประวัติปั๊มที่ได้รับสิทธิ์ · อ่านอย่างเดียว',ids:['platform-support-workspace'],yes:support},
  {key:'sales',label:p?'ทีมขายและค่าคอมมิชชั่น':'งานขายของฉัน',icon:'users',desc:'ปั๊มที่ดูแล ประวัติการย้ายงาน และค่าคอมมิชชั่น',ids:['platform-sales-workspace'],yes:p||sales},
  {key:'activity',label:'ประวัติการดำเนินการ',icon:'clipboard',desc:'ใครทำอะไร เมื่อไร · ดูย้อนหลังตามปั๊ม',ids:['platform-sales-activity'],yes:p||sales},
  {key:'stations',label:p?'จัดการปั๊มน้ำมัน':'เปิดปั๊มของฉัน',icon:'building',desc:p?'สร้างปั๊ม เลือกแบรนด์และเปิดโมดูล':'สร้างปั๊มด้วยบัญชี Sales และดูปั๊มที่รับผิดชอบ',ids:['platform-workspace'],yes:p||sales},
  {key:'plan',label:'แพ็กเกจและชำระเงิน',icon:'wallet',desc:'เลือกแพ็กเกจและวิธีชำระเงิน',
    ids:['station-saas-plan-workspace'],
    yes:memberships.some(m=>m.scopeType==='station'&&m.stationId&&['station_owner','owner'].includes(m.role))},
  {key:'billing',label:p?'แพ็กเกจและ VAT':'ค่าบริการ',icon:'receipt',desc:p?'กำหนด VAT และแพ็กเกจให้ลูกค้าเลือก':'ดูและชำระค่าบริการ',ids:[...(p?['platform-saas-billing']:[]),...(b?['saas-billing-workspace']:[])],yes:p||b},
  {key:'fuel',label:'ชนิดและราคาน้ำมัน',icon:'fuel',desc:'กำหนดสินค้าและราคาหน้าปั๊ม',ids:['station-fuel-workspace'],yes:s},
  {key:'pump',label:'งานหน้าลาน',icon:'scan',desc:'จัดการคูปองและรายการเติมน้ำมัน',ids:['station-pump-workspace'],yes:pump},
  {key:'customers',label:'ลูกค้าบริษัท',icon:'building',desc:'บัญชีลูกค้าและวงเงิน',ids:['station-customers-workspace'],yes:s},
  {key:'finance',label:'การเงิน',icon:'wallet',desc:'รับเงินและตรวจสอบหลักฐาน',ids:['station-finance-workspace'],yes:s},
  {key:'hr',label:'พนักงานและกะ',icon:'users',desc:'บริหารพนักงานและตารางกะ',ids:['hr-workspace'],yes:s},
  {key:'attendance',label:'ลงเวลา',icon:'calendar',desc:'ลงเวลาทำงาน',ids:['attendance-workspace'],yes:attendance},
  {key:'reviews',label:'อนุมัติลงเวลา',icon:'check',desc:'ตรวจรายการลงเวลา',ids:['attendance-review-workspace'],yes:review},
  {key:'payroll',label:'สรุปเงินเดือน',icon:'receipt',desc:'ตรวจข้อมูลเตรียมจ่าย',ids:['attendance-payroll-preview-workspace'],yes:review},
  {key:'corporate',label:'บัญชีบริษัท',icon:'ticket',desc:'คูปองและประวัติใช้วงเงิน',ids:['corporate-workspace'],yes:corp},
  {key:'invitations',label:'เชิญสมาชิก',icon:'user-plus',desc:'เชิญและกำหนดสิทธิ์',ids:['member-invites'],yes:s||invite||sales}
 ].filter(x=>x.yes);
}


export function renderWorkspaceShell(screens){
 const quick=screens.filter(s=>s.key!=="overview").map(s=>`
 <button class="ws-quick" type="button" data-ws-go="${s.key}">
  <span class="ws-quick-copy"><strong>${s.label}</strong><small>${s.desc}</small></span>
  <span class="ws-quick-arrow" aria-hidden="true">›</span>
 </button>`).join("");
 const panels=screens.map((s,i)=>`
 <section class="panel ws-screen" data-ws-screen="${s.key}" id="ws-${s.key}"
   ${i===0?"":"hidden"} aria-labelledby="ws-heading-${s.key}">
   <div class="ws-screen-head">
     <div class="ws-breadcrumb">OilStation <span aria-hidden="true">/</span> ${s.label}</div>
     <h2 id="ws-heading-${s.key}" tabindex="-1">${s.key==="overview"?"พื้นที่ทำงานของคุณ":s.label}</h2>
     <p>${s.key==="overview"?"เลือกงานที่ต้องการจากรายการด้านล่าง ทุกเมนูแสดงตามสิทธิ์ที่ได้รับ":s.desc}</p>
   </div>
   ${s.key==="overview"?`
     ${renderMobileHome(screens)}
     <div class="ws-overview-columns">
       <div class="ws-overview-primary">
         <div class="ws-section-heading"><h3>เริ่มทำงาน</h3>
           <span>งานที่พร้อมใช้งานสำหรับบัญชีนี้</span></div>
         <div class="ws-quick-grid">${quick||'<p class="ws-empty">ยังไม่มีงานให้เลือกสำหรับสิทธิ์นี้</p>'}</div>
       </div>
       <aside class="ws-overview-side" aria-label="ข้อมูลสิทธิ์ของคุณ">
         <div class="ws-section-heading"><h3>สิทธิ์ของคุณ</h3></div>
         <div class="scope-list" id="scopes"></div>
         <div class="ws-section-heading ws-section-heading-spaced"><h3>พื้นที่รับผิดชอบ</h3></div>
         <div class="module-list" id="modules"></div>
       </aside>
     </div>`:
     `<div class="os-mobile-page-content">${s.ids.map(id=>`<div class="ws-widget" id="${id}"></div>`).join("")}</div>`}
 </section>`).join("");
 const context=screens.filter(item=>item.key!=='overview').map(item=>
  `<div class="ws-context-group" data-context-for="${item.key}" hidden>${renderWorkspaceCategories(screens,item.key)}</div>`).join('');
 return `<div class="ws-layout" data-workspace-shell data-active-screen="overview">
   <div class="ws-main">
     <div class="ws-toolbar">
       <span class="ws-toolbar-title"><img class="ws-toolbar-brand" src="/oilstation-gold-logo.png?v=2" width="28" height="28" alt="" aria-hidden="true">OilStation <span>ระบบบริหารสถานีบริการน้ำมัน</span></span>
       <button type="button" class="os-toolbar-logout" data-mobile-logout aria-label="ออกจากระบบ">ออกจากระบบ</button>
     </div>
     <header class="ws-header">
       <div class="ws-header-copy">
         <p class="ws-overline">OILSTATION / WORKSPACE</p>
         <h1 id="scope-title"></h1>
         <p>ศูนย์จัดการงานของคุณในที่เดียว</p>
       </div>
       <span class="ws-current" id="ws-current">ภาพรวม</span>
     </header>
     <div class="ws-context-host" data-context-host>${context}</div>
     <div class="ws-content" id="ws-content">${panels}</div>
   </div>
   ${renderMobileNav(screens)}
   ${renderLogoutDialog()}
 </div>`;
}

export function wireWorkspaceNavigation(root,{screens=[],userId=null}={}){
 const views=[...root.querySelectorAll('[data-ws-screen]')];
 const allowed=new Set(views.map(v=>v.dataset.wsScreen));
 const shell=root.querySelector('[data-workspace-shell]');
 const current=root.querySelector('#ws-current');
 const groups=[...root.querySelectorAll('[data-context-for]')];
 const homeSearch=root.querySelector('[data-mobile-search-input]');
 wireLogoutDialog(root);
 homeSearch?.addEventListener('input',()=>{
  const query=homeSearch.value.trim().toLocaleLowerCase('th');
  let matches=0;
  for(const item of root.querySelectorAll('[data-mobile-feature]')){
   const match=item.dataset.mobileSearch?.toLocaleLowerCase('th').includes(query);
   item.hidden=!match;if(match)matches++;
  }
  const empty=root.querySelector('[data-mobile-no-results]');
  if(empty)empty.hidden=matches>0;
 });
 let counts=readNavUsage(userId);
 const bottom=()=>{
  const nav=root.querySelector('.os-mobile-bottom');
  if(!nav)return;
  nav.outerHTML=renderMobileNav(screens,counts);
  decorateIcons(root.querySelector('.os-mobile-bottom'));
 };
 const navigateTo=(key,{track=false}={})=>{
  if(!allowed.has(key))return false;
  const view=views.find(v=>v.dataset.wsScreen===key);
  views.forEach(v=>{v.hidden=v!==view;});
  for(const g of groups)g.hidden=g.dataset.contextFor!==key;
  if(shell)shell.dataset.activeScreen=key;
  const heading=view.querySelector('h2');
  if(current)current.textContent=heading?.textContent||'OilStation';
  if(track&&key!=='overview'){
   counts=incrementNavUsage(counts,key);saveNavUsage(userId,counts);
  }
  // Keep a stable dock during work; update frequency order only on Home.
  if(key==='overview')bottom();
  root.querySelectorAll('[data-ws-go]').forEach(button=>{
   const active=button.dataset.wsGo===key;
   button.classList.toggle('active',active);
   button.classList.toggle('is-current',active);
   if(active)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  });
  try{sessionStorage.setItem('oilstation_last_workspace',key);}catch{}
  shell?.dispatchEvent(new CustomEvent('oilstation:screenchange',{detail:{key}}));
  root.querySelector('.ws-main')?.scrollIntoView?.({block:'start',behavior:'auto'});
  if(track){
   const focusTarget=root.querySelector('.os-mobile-bottom [data-ws-go="'+key+'"]');
   if(typeof matchMedia==='function'&&matchMedia('(max-width:850px)').matches){
    (focusTarget||view.querySelector('h2'))?.focus?.({preventScroll:true});
   }else view.querySelector('h2')?.focus?.({preventScroll:true});
  }
  return true;
 };
 root.addEventListener('click',event=>{
  const link=event.target.closest?.('[data-ws-go]');
  if(link&&root.contains(link))navigateTo(link.dataset.wsGo,{track:true});
 });
 bottom();
 return {navigateTo};
}
