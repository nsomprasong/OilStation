import {makeIcon} from './icons.js';
// Current Supabase user only. This is presentation, never a privilege source.
const roleLabels={
 platform_superadmin:'ผู้ดูแลระบบสูงสุด',
 platform_sales:'ทีมขาย',
 platform_support:'ฝ่ายสนับสนุน',
 station_owner:'เจ้าของปั๊ม',
 organization_owner:'เจ้าของกิจการ',
 corporate_admin:'ผู้ดูแลบัญชีบริษัท',
 finance_manager:'ผู้จัดการการเงิน',
 cashier:'พนักงานหน้าลาน',
 driver:'คนขับรถ',
};
const displayRole=role=>roleLabels[role]||role||'ผู้ใช้งาน';
export function mountUserProfile({target,user,memberships=[]}={}){
 if(!target||!user)return;
 const name=String(user.user_metadata?.full_name||
   user.user_metadata?.name||user.user_metadata?.username||user.email?.split('@')[0]||'ผู้ใช้งาน').slice(0,100);
 const email=String(user.email||'').slice(0,254);
 const wrap=document.createElement('div');wrap.className='os-profile';
 const trigger=document.createElement('button');
 trigger.type='button';trigger.className='os-profile-trigger';
 trigger.setAttribute('aria-label','แสดงโปรไฟล์ผู้ใช้');
 trigger.setAttribute('aria-expanded','false');
 const avatar=document.createElement('span');avatar.className='os-profile-avatar';
 avatar.textContent=name.trim().charAt(0).toUpperCase()||'U';
 const summary=document.createElement('span');summary.className='os-profile-summary';
 const title=document.createElement('strong');title.textContent=name;
 const subtitle=document.createElement('small');
 subtitle.textContent=displayRole(memberships[0]?.role);
 summary.append(title,subtitle);trigger.append(avatar,summary);
 const panel=document.createElement('div');panel.className='os-profile-panel';panel.hidden=true;
 const head=document.createElement('div');head.className='os-profile-panel-head';
 head.append(makeIcon('users'));
 const h=document.createElement('strong');h.textContent='ข้อมูลผู้ใช้';
 head.append(h);panel.append(head);
 const label=document.createElement('span');label.textContent='ชื่อที่แสดง';
 const value=document.createElement('p');value.textContent=name;
 const emailLabel=document.createElement('span');emailLabel.textContent='อีเมล';
 const emailValue=document.createElement('p');emailValue.textContent=email||'ไม่มีอีเมล';
 const roleLabel=document.createElement('span');roleLabel.textContent='สิทธิ์ที่ได้รับ';
 const roles=document.createElement('div');roles.className='os-profile-roles';
 for(const membership of memberships){
  const item=document.createElement('span');item.textContent=displayRole(membership.role);
  roles.append(item);
 }
 panel.append(label,value,emailLabel,emailValue,roleLabel,roles);
 const show=visible=>{
  panel.hidden=!visible;trigger.setAttribute('aria-expanded',String(visible));
 };
 trigger.addEventListener('click',()=>show(panel.hidden));
 document.addEventListener('click',event=>{
  if(!wrap.isConnected)return;
  if(!wrap.contains(event.target))show(false);
 });
 wrap.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!panel.hidden){show(false);trigger.focus();}
 });
 wrap.append(trigger,panel);target.replaceChildren(wrap);
}
