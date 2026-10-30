/** Six task groups. Only available role-issued screens can become links. */
export const TASK_GROUPS=[
 {key:'overview',label:'ภาพรวม',keys:['overview']},
 {key:'stations',label:'ปั๊มและน้ำมัน',keys:['stations','fuel','pump']},
 {key:'customers',label:'ลูกค้าบริษัท',keys:['customers','corporate']},
 {key:'people',label:'บุคลากร',keys:['hr','attendance','reviews','payroll']},
 {key:'finance',label:'การเงิน',keys:['finance','billing','plan']},
 {key:'settings',label:'จัดการสิทธิ์',keys:['invitations']},
];
export function categoryFor(screenKey){
 return TASK_GROUPS.find(g=>g.keys.includes(screenKey))?.key||'overview';
}
export function renderWorkspaceCategories(screens,activeKey){
 const byKey=new Map(screens.map(s=>[s.key,s]));
 return `<nav class="os-category-nav" aria-label="หมวดเมนูหลัก">
  ${TASK_GROUPS.map(group=>{
   const allowed=group.keys.filter(k=>byKey.has(k));
   if(!allowed.length)return '';
   const active=group.keys.includes(activeKey);
   return `<button type="button" data-ws-go="${activeKey&&active?activeKey:allowed[0]}"
    class="os-category-tab${active?' active':''}" data-task-group="${group.key}"
    aria-label="${group.label}" ${active?'aria-current="page"':''}>${group.label}</button>`;
  }).join('')}
 </nav>`;
}
