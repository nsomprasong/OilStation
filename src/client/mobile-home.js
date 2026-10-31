import {selectFrequentScreens} from './nav-preferences.js';
/** Mobile-first OilStation presentation, modeled on the user's reference layout.
 * All features are filtered from server-issued membership screens.
 * No wallet amount or transaction state is fabricated for the home cards.
 */
export function chooseMobileActions(screens,counts={}){
 const frequent=selectFrequentScreens(screens,counts,4);
 const headline=frequent.map(x=>x.key);
 return {work:headline[0]||null,history:headline[1]||null,
  headline,canScan:screens.some(s=>s.key==='pump')};
}

export function renderMobileHome(screens){
 const available=screens.filter(s=>s.key!=='overview');
 const features=available.map(s=>`<button class="os-mobile-feature" type="button"
   data-ws-go="${s.key}" data-mobile-feature data-mobile-search="${s.label} ${s.desc}">
   <span class="os-mobile-feature-icon"><i data-ui-icon="${s.icon}"></i></span>
   <span>${s.label}</span></button>`).join('');
 return `<div class="os-mobile-home" data-mobile-home>
   <section class="os-mobile-hero" aria-label="พื้นที่ทำงาน OilStation">
     <div class="os-mobile-hero-title">
       <div><div class="os-mobile-brandline"><img class="os-mobile-brandmark" src="/oilstation-gold-logo.png?v=2" width="40" height="40" alt="" aria-hidden="true"><span class="os-mobile-eyebrow">OILSTATION</span></div>
         <h3>พร้อมเริ่มงานวันนี้</h3><p>เลือกบริการทั้งหมดได้จากหน้าแรก ตามสิทธิ์ของบัญชี</p></div>
       <button class="os-mobile-power" type="button" data-mobile-logout
         aria-label="ออกจากระบบ" title="ออกจากระบบ">
         <i data-ui-icon="power"></i>
       </button>
     </div>
     <label class="os-mobile-search"><i data-ui-icon="scan"></i>
       <input type="search" data-mobile-search-input autocomplete="off"
          placeholder="ค้นหาบริการ" aria-label="ค้นหาบริการของ OilStation"></label>
     <div class="os-mobile-summary-grid">
       <article class="os-mobile-summary-card"><span class="os-mobile-summary-icon"><i data-ui-icon="shield"></i></span>
         <h4>พื้นที่ทำงานของคุณ</h4><p>แสดงเฉพาะบริการที่บัญชีได้รับสิทธิ์</p></article>
       <article class="os-mobile-summary-card"><span class="os-mobile-summary-icon"><i data-ui-icon="clipboard"></i></span>
         <h4>บริการที่เข้าถึงได้</h4><strong class="os-mobile-summary-number">${available.length} รายการ</strong>
         <p>ดูทุกบริการได้จากหน้าแรก</p></article>
     </div>
   </section>
   <section class="os-mobile-features" aria-label="บริการทั้งหมด">
     <div class="os-mobile-section-title"><h3>บริการทั้งหมด</h3><span>${available.length} รายการ</span></div>
     <div class="os-mobile-feature-grid">${features}</div>
     <p class="os-mobile-no-results" data-mobile-no-results hidden>ไม่พบบริการที่ค้นหา ลองใช้คำอื่น</p>
   </section>
 </div>`;
}

export function renderMobileNav(screens,counts={}){
 const frequent=selectFrequentScreens(screens,counts,4);
 const item=s=>`<button class="os-mobile-tab os-nav-orb-item" type="button" data-ws-go="${s.key}"
   aria-label="${s.label}" title="${s.label}">
   <span class="os-nav-orb"><i data-ui-icon="${s.icon}"></i></span>
   <span class="os-nav-caption">${s.label}</span></button>`;
 const placeholders=Array.from({length:4-frequent.length},()=>
   '<span class="os-mobile-tab os-nav-orb-placeholder" aria-hidden="true"></span>').join('');
 return `<nav class="os-mobile-bottom" aria-label="เมนูนำทางที่ใช้บ่อย">
   <button class="os-mobile-tab os-nav-orb-item is-current" type="button" data-ws-go="overview" aria-current="page">
     <span class="os-nav-orb"><i data-ui-icon="home"></i></span><span class="os-nav-caption">Home</span></button>
   ${frequent.map(item).join('')}${placeholders}
 </nav>`;
}

export function renderMobileScreenHero(screen,screens=[]){
 if(!screen||screen.key==='overview')return '';
 const suggestions={
  stations:['sales','billing','invitations'],sales:['stations','activity','billing'],activity:['sales','stations'],fuel:['pump','customers','finance'],
  pump:['fuel','customers','reviews'],customers:['finance','pump','fuel'],
  finance:['customers','billing','pump'],plan:['billing','pump','fuel'],
  billing:['stations','plan','finance'],hr:['attendance','reviews','payroll'],
  attendance:['reviews','hr','payroll'],reviews:['attendance','payroll','hr'],
  payroll:['reviews','attendance','hr'],corporate:['billing','invitations','finance'],
  invitations:['stations','sales','hr'],
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
