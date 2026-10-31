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
 const byKey=new Map(screens.map(item=>[item.key,item]));
 const group=TASK_GROUPS.find(item=>item.keys.includes(activeKey));
 const allowed=(group?.keys||[]).filter(key=>byKey.has(key));
 if(allowed.length<2)return '';
 return `<nav class="os-category-nav" aria-label="เมนูที่เกี่ยวข้อง">
  ${allowed.map(key=>{
    const item=byKey.get(key),current=key===activeKey;
    return `<button type="button" data-ws-go="${key}"
      data-task-group="${group.key}" class="os-category-tab${current?' active':''}"
      aria-label="${item.label}" ${current?'aria-current="page"':''}>${item.label}</button>`;
   }).join('')}
 </nav>`;
}
