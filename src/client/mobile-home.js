/** Mobile-first OilStation presentation, modeled on the user's reference layout.
 * All features are filtered from server-issued membership screens.
 * No wallet amount or transaction state is fabricated for the home cards.
 */
export function chooseMobileActions(screens){
 const keys=new Set(screens.map(s=>s.key));
 const pick=(order,used)=>order.find(key=>keys.has(key)&&!used.has(key))||null;
 const used=new Set(['overview']);
 const work=pick(['fuel','stations','customers','corporate','hr','attendance','billing','plan','pump','finance','invitations'],used);if(work)used.add(work);
 const history=pick(['reviews','finance','payroll','attendance','billing','corporate','plan','stations','pump','hr','invitations','customers'],used);if(history)used.add(history);
 const headline=['pump','fuel','stations','corporate','billing','plan','finance','attendance','hr','customers','reviews','invitations','payroll']
  .filter(key=>keys.has(key)).slice(0,4);
 return {work,history,headline,canScan:keys.has('pump')};
}

export function renderMobileHome(screens){
 const {headline}=chooseMobileActions(screens);
 const available=screens.filter(s=>s.key!=='overview');
 const headlineMarkup=headline.map(key=>{
  const s=screens.find(x=>x.key===key);
  return `<button class="os-mobile-quick" type="button" data-ws-go="${s.key}" data-mobile-feature
    data-mobile-search="${s.label} ${s.desc}"><span class="os-mobile-quick-icon"><i data-ui-icon="${s.icon}"></i></span>
    <span>${s.label}</span></button>`;
 }).join('');
 const features=available.map(s=>`<button class="os-mobile-feature" type="button"
   data-ws-go="${s.key}" data-mobile-feature data-mobile-search="${s.label} ${s.desc}">
   <span class="os-mobile-feature-icon"><i data-ui-icon="${s.icon}"></i></span>
   <span>${s.label}</span></button>`).join('');
 return `<div class="os-mobile-home" data-mobile-home>
   <section class="os-mobile-hero" aria-label="พื้นที่ทำงาน OilStation">
     <div class="os-mobile-hero-title">
       <div><div class="os-mobile-brandline"><img class="os-mobile-brandmark" src="/oilstation-gold-logo.png" width="40" height="40" alt="" aria-hidden="true"><span class="os-mobile-eyebrow">OILSTATION</span></div>
         <h3>พร้อมเริ่มงานวันนี้</h3><p>เลือกบริการหรือสแกน QR คูปองได้จากหน้าแรก</p></div>
       <button class="os-mobile-power" type="button" data-mobile-logout
         aria-label="ออกจากระบบ" title="ออกจากระบบ">
         <i data-ui-icon="power"></i>
       </button>
     </div>
     <label class="os-mobile-search"><i data-ui-icon="scan"></i>
       <input type="search" data-mobile-search-input autocomplete="off"
          placeholder="ค้นหาบริการ" aria-label="ค้นหาบริการของ OilStation"></label>
     <div class="os-mobile-quick-grid" aria-label="ทางลัดใช้งาน">${headlineMarkup}</div>
     <div class="os-mobile-summary-grid">
       <article class="os-mobile-summary-card"><span class="os-mobile-summary-icon"><i data-ui-icon="shield"></i></span>
         <h4>พื้นที่ทำงานของคุณ</h4><p>แสดงเฉพาะบริการที่บัญชีได้รับสิทธิ์</p></article>
       <article class="os-mobile-summary-card"><span class="os-mobile-summary-icon"><i data-ui-icon="clipboard"></i></span>
         <h4>บริการที่เข้าถึงได้</h4><strong class="os-mobile-summary-number">${available.length} รายการ</strong>
         <p>เลือกบริการได้จากเมนูด้านล่าง</p></article>
     </div>
   </section>
   <section class="os-mobile-features" aria-label="บริการทั้งหมด">
     <div class="os-mobile-section-title"><h3>บริการทั้งหมด</h3><span>${available.length} รายการ</span></div>
     <div class="os-mobile-feature-grid">${features}</div>
     <p class="os-mobile-no-results" data-mobile-no-results hidden>ไม่พบบริการที่ค้นหา ลองใช้คำอื่น</p>
   </section>
 </div>`;
}

export function renderMobileNav(screens){
 const {work,history,canScan}=chooseMobileActions(screens);
 const s=k=>screens.find(x=>x.key===k);
 const entry=(key,icon,label)=>{
  if(!key)return `<span class="os-mobile-tab os-mobile-tab-placeholder" aria-hidden="true"></span>`;
  const screen=s(key);
  return `<button type="button" class="os-mobile-tab" data-ws-go="${key}"
     aria-label="${screen.label}" title="${screen.label}">
     <i data-ui-icon="${icon}"></i><span>${label}</span></button>`;
 };
 return `<nav class="os-mobile-bottom" aria-label="เมนูมือถือ">
  <button class="os-mobile-tab is-current" type="button" data-ws-go="overview" aria-current="page">
    <i data-ui-icon="home"></i><span>หน้าแรก</span></button>
  ${entry(work,s(work)?.icon||'clipboard','งาน')}
  <button class="os-mobile-tab os-mobile-scan" type="button"
    data-ws-scan aria-label="${canScan?'เปิดกล้องสแกน QR คูปอง':'ไม่มีสิทธิ์สแกน QR คูปอง'}"
    ${canScan?'':'disabled title="บัญชีนี้ไม่มีสิทธิ์งานหน้าลาน"'}>
    <span class="os-mobile-scan-bubble"><i data-ui-icon="scan"></i></span><span>สแกน</span>
  </button>
  ${entry(history,s(history)?.icon||'receipt','รายการ')}
  <button class="os-mobile-tab" type="button" data-ws-more aria-label="เปิดเมนูทั้งหมด"
    aria-controls="ws-sidebar" aria-expanded="false"><i data-ui-icon="menu"></i><span>เมนู</span></button>
 </nav>`;
}

export function renderMobileScreenHero(screen,screens=[]){
 if(!screen||screen.key==='overview')return '';
 const suggestions={
  stations:['billing','invitations','fuel'],fuel:['pump','customers','finance'],
  pump:['fuel','customers','reviews'],customers:['finance','pump','fuel'],
  finance:['customers','billing','pump'],plan:['billing','pump','fuel'],
  billing:['stations','plan','finance'],hr:['attendance','reviews','payroll'],
  attendance:['reviews','hr','payroll'],reviews:['attendance','payroll','hr'],
  payroll:['reviews','attendance','hr'],corporate:['billing','invitations','finance'],
  invitations:['stations','hr','corporate'],
 };
 const eligible=new Set(screens.map(item=>item.key));
 const related=(suggestions[screen.key]||[]).filter(key=>eligible.has(key)&&key!==screen.key)
   .slice(0,3).map(key=>screens.find(s=>s.key===key));
 return `<div class="os-mobile-page-hero" aria-label="หัวข้อ${screen.label}">
   <div class="os-mobile-page-top">
     <span class="os-mobile-eyebrow">OILSTATION / WORKSPACE</span>
     <button class="os-mobile-page-home" type="button" data-ws-go="overview">
       <i data-ui-icon="home"></i><span>หน้าแรก</span>
     </button>
   </div>
   <div class="os-mobile-page-heading">
     <span class="os-mobile-page-icon"><i data-ui-icon="${screen.icon}"></i></span>
     <div class="os-mobile-page-copy">
       <span class="os-mobile-page-kicker">พื้นที่ทำงาน</span>
       <strong>${screen.label}</strong>
       <p>${screen.desc}</p>
     </div>
   </div>
   ${related.length?`<div class="os-mobile-page-shortcuts" aria-label="ทางลัดบริการที่เกี่ยวข้อง">
     ${related.map(s=>`<button type="button" data-ws-go="${s.key}" title="${s.label}">
       <i data-ui-icon="${s.icon}"></i><span>${s.label}</span>
     </button>`).join('')}
   </div>`:''}
 </div>`;
}
