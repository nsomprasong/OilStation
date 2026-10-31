/** Six task groups. Only available role-issued screens can become links. */
export const TASK_GROUPS=[
 {key:'overview',label:'ภาพรวม',keys:['overview']},
 {key:'stations',label:'ปั๊มและน้ำมัน',keys:['stations','sales','activity','fuel','pump']},
 {key:'customers',label:'ลูกค้าและทีมขาย',keys:['customers','corporate']},
 {key:'people',label:'บุคลากร',keys:['hr','attendance','reviews','payroll']},
 {key:'finance',label:'การเงิน',keys:['finance','billing','plan']},
 {key:'settings',label:'จัดการสิทธิ์',keys:['invitations']},
];
export function categoryFor(screenKey){
 return TASK_GROUPS.find(g=>g.keys.includes(screenKey))?.key||'overview';
}
/** Context-only quick links. Full authorized catalogue lives on Home. */
export function renderWorkspaceCategories(screens,activeKey){
 if(activeKey==='overview')return '';
 const byKey=new Map(screens.map(s=>[s.key,s]));
 const group=TASK_GROUPS.find(g=>g.keys.includes(activeKey));
 const items=(group?.keys||[activeKey]).filter(key=>byKey.has(key));
 if(!items.length)return '';
 return `<nav class="os-category-nav os-context-orbs" aria-label="เมนูย่อยที่เกี่ยวข้อง">
  ${items.map(key=>{
   const s=byKey.get(key),active=key===activeKey;
   return `<button type="button" class="os-category-tab os-nav-orb-item${active?' active':''}"
     data-ws-go="${s.key}" aria-label="${s.label}" title="${s.label}"
     ${active?'aria-current="page"':''}>
     <span class="os-nav-orb"><i data-ui-icon="${s.icon}"></i></span>
     <span class="os-nav-caption">${s.label}</span></button>`;
  }).join('')}
 </nav>`;
}
