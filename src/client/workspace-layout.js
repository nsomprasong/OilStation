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
  {key:'overview',label:'ภาพรวม',icon:'clipboard',desc:'สิทธิ์และทางลัด',ids:[],yes:true},
  {key:'stations',label:'จัดการปั๊มน้ำมัน',icon:'building',desc:'สร้างปั๊ม เลือกแบรนด์และเปิดโมดูล',ids:['platform-workspace'],yes:p},
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
  {key:'invitations',label:'เชิญสมาชิก',icon:'user-plus',desc:'เชิญและกำหนดสิทธิ์',ids:['member-invites'],yes:s||invite}
 ].filter(x=>x.yes);
}

const NAV_GROUPS=[{"title":"เริ่มต้น","keys":["overview"]},{"title":"จัดการแพลตฟอร์ม","keys":["stations","billing"]},{"title":"งานปั๊มน้ำมัน","keys":["fuel","pump","customers","finance","plan"]},{"title":"ทีมงาน","keys":["hr","attendance","reviews","payroll","invitations"]},{"title":"ลูกค้าบริษัท","keys":["corporate"]}];
const NAV_ICONS=new Set(["fuel","users","wallet","calendar","qr","logout","shield","mail","clipboard","scan","ticket","building","user-plus","receipt","camera","check","settings"]);
export function navMarkup(screens){
 return NAV_GROUPS.map(group=>{
  const items=group.keys.map(key=>screens.find(s=>s.key===key)).filter(Boolean);
  if(!items.length)return "";
  return `<div class="ws-nav-group"><div class="ws-nav-heading">${group.title}</div>
   ${items.map(s=>`<button type="button" class="ws-nav${s.key==="overview"?" active":""}"
    data-ws-go="${s.key}" aria-controls="ws-${s.key}" ${s.key==="overview"?'aria-current="page"':""}>
    <i data-ui-icon="${NAV_ICONS.has(s.icon)?s.icon:"clipboard"}"></i><span>${s.label}</span>
    </button>`).join("")}</div>`;
 }).join("");
}

export function renderWorkspaceShell(screens){
 const quick=screens.filter(s=>s.key!=="overview").slice(0,6).map(s=>`
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
     s.ids.map(id=>`<div class="ws-widget" id="${id}"></div>`).join("")}
 </section>`).join("");
 return `<div class="ws-layout" data-workspace-shell>
   <button class="ws-menu-backdrop" type="button" data-ws-menu-close hidden
     aria-label="ปิดเมนูนำทาง"></button>
   <aside class="ws-sidebar" id="ws-sidebar" aria-label="เมนูพื้นที่ทำงาน">
     <div class="ws-side-head">
       <span class="ws-logo" aria-hidden="true">O</span>
       <div><strong>OilStation</strong><small>OPERATIONS</small></div>
       <button type="button" class="ws-mobile-close" data-ws-menu-close aria-label="ปิดเมนู">×</button>
     </div>
     <nav class="ws-nav-list" aria-label="เมนูหลัก">${navMarkup(screens)}</nav>
     <div class="ws-sidebar-bottom">
       <span class="ws-sidebar-caption">ระบบบริหารจัดการสถานีบริการน้ำมัน</span>
       <button class="ws-signout" id="logout" type="button"><i data-ui-icon="logout"></i>ออกจากระบบ</button>
     </div>
   </aside>
   <div class="ws-main">
     <header class="ws-header">
       <button class="ws-mobile-toggle" type="button" aria-label="เปิดเมนู"
         aria-controls="ws-sidebar" aria-expanded="false" data-ws-menu-toggle>
         <span aria-hidden="true">☰</span><span>เมนู</span>
       </button>
       <div class="ws-header-copy">
         <p class="ws-overline">OILSTATION / WORKSPACE</p>
         <h1 id="scope-title"></h1>
         <p>ศูนย์จัดการงานของคุณในที่เดียว</p>
       </div>
       <span class="ws-current" id="ws-current">ภาพรวม</span>
     </header>
     <div class="ws-content" id="ws-content">${panels}</div>
   </div>
 </div>`;
}

export function wireWorkspaceNavigation(root){
 const views=[...root.querySelectorAll("[data-ws-screen]")];
 const links=[...root.querySelectorAll("[data-ws-go]")];
 const menuToggle=root.querySelector("[data-ws-menu-toggle]");
 const backdrop=root.querySelector(".ws-menu-backdrop");
 const menu=root.querySelector(".ws-sidebar");
 const mobile=typeof matchMedia==="function"?matchMedia("(max-width:850px)"):null;
 let open=false;
 const focusable=()=>[...menu.querySelectorAll("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])")]
   .filter(node=>!node.hidden&&node.getClientRects().length>0);
 const syncMenu=()=>{
  const active=Boolean(mobile?.matches&&open);
  menu?.classList.toggle("is-open",active);
  if(menu)menu.inert=Boolean(mobile?.matches&&!active);
  if(backdrop)backdrop.hidden=!active;
  menuToggle?.setAttribute("aria-expanded",String(active));
 };
 const closeMenu=()=>{
  open=false;syncMenu();
 };
 const openMenu=()=>{
  open=true;syncMenu();
  focusable()[0]?.focus();
 };
 syncMenu();
 mobile?.addEventListener?.("change",()=>{open=false;syncMenu();});
 menuToggle?.addEventListener("click",()=>{
  if(open)closeMenu();else openMenu();
 });
 root.querySelectorAll("[data-ws-menu-close]").forEach(button=>
  button.addEventListener("click",()=>{closeMenu();menuToggle?.focus();}));
 menu?.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&open){
   event.preventDefault();closeMenu();menuToggle?.focus();return;
  }
  if(event.key==="Tab"&&open){
   const all=focusable();
   if(!all.length)return;
   const first=all[0],last=all[all.length-1];
   if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();first.focus();
   }
  }
 });
 for(const button of links){
  button.addEventListener("click",()=>{
   const key=button.dataset.wsGo;
   const view=views.find(x=>x.dataset.wsScreen===key);
   if(!view)return;
   views.forEach(v=>{v.hidden=v!==view;});
   links.forEach(link=>{
    const active=link.dataset.wsGo===key;
    link.classList.toggle("active",active);
    if(active&&link.closest("nav"))link.setAttribute("aria-current","page");
    else link.removeAttribute("aria-current");
   });
   const heading=view.querySelector("h2");
   const current=root.querySelector("#ws-current");
   if(current&&heading)current.textContent=heading.textContent;
   try{sessionStorage.setItem("oilstation_last_workspace",key);}catch{}
   closeMenu();
   if(mobile?.matches)menuToggle?.focus();
   else heading?.focus({preventScroll:true});
   root.querySelector('[data-workspace-shell]')?.dispatchEvent(
     new CustomEvent('oilstation:screenchange',{detail:{key}}));
   root.querySelector(".ws-main")?.scrollIntoView({block:"start",behavior:"auto"});
  });
 }
}
