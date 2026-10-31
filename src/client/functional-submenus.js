import {makeIcon} from './icons.js';

/** One functional task at a time; never promote data-record cards to navigation. */
const DESCRIPTORS={
 sales:{kind:'direct',host:'.os-sales-workspace',selector:':scope > section.os-sales-panel',
  // Only top-level tasks: invite belongs to team, inspection to stations,
  // assignment history to transfer, paid customers to commission.
  names:['ทีมขาย','ปั๊มที่รับผิดชอบ','ย้ายการดูแล','ค่าคอมมิชชั่น'],
  ids:['team','assignment','transfer','commission'],
  icons:['users','building','settings','receipt'],start:'assignment'},
 stations:{kind:'stations',start:'directory'},
 billing:{kind:'billing',start:'plans'},
 customers:{kind:'ranges',host:'#station-customers-workspace',
  breaks:[{id:'new',label:'เปิดบัญชีบริษัท',icon:'user-plus'},
   {id:'link',label:'เชื่อมบริษัทเดิม',icon:'building',anchor:'#customer-link-form',previous:'H3'}]},
 hr:{kind:'ranges',host:'#hr-workspace',breaks:[
  {id:'people',label:'พนักงาน',icon:'users'},
  {id:'schedule',label:'จัดกะ',icon:'calendar',anchor:'#hr-schedule',previous:'DIV'},
  {id:'replacement',label:'ทำงานแทน',icon:'users',anchor:'#hr-replacement',previous:'H3'},
  {id:'overtime',label:'ขอ OT',icon:'clipboard',anchor:'#hr-ot-request',previous:'H3'},
  {id:'pending-ot',label:'OT รอตรวจสอบ',icon:'check',anchor:'#hr-ot-pending',previous:'H3'},
  {id:'approvals',label:'รายการรออนุมัติ',icon:'clipboard',anchor:'#hr-pending-approvals',previous:'H3'}]},
 corporate:{kind:'ranges',host:'#corporate-workspace',breaks:[
  {id:'account',label:'บัญชีบริษัท',icon:'building'},
  {id:'topup',label:'แจ้งเติมเงิน',icon:'receipt',anchor:'#topup-upload-form'},
  {id:'coupon',label:'ออกคูปอง',icon:'ticket',anchor:'#coupon-form'}]},
 fuel:{kind:'single',label:'ชนิดและราคาน้ำมัน',icon:'fuel'},
 pump:{kind:'single',label:'สแกนและตรวจคูปอง',icon:'scan'},
 finance:{kind:'single',label:'ตรวจหลักฐานและอนุมัติ',icon:'wallet'},
 plan:{kind:'single',label:'เลือกแพ็กเกจ',icon:'wallet'},
 attendance:{kind:'single',label:'ลงเวลาทำงาน',icon:'calendar'},
 reviews:{kind:'single',label:'อนุมัติลงเวลา',icon:'check'},
 payroll:{kind:'single',label:'สรุปเวลาทำงาน',icon:'receipt'},
 activity:{kind:'single',label:'ประวัติการดำเนินการ',icon:'clipboard'},
 invitations:{kind:'single',label:'เชิญสมาชิก',icon:'user-plus'},
};

const pane=(id,label,icon,nodes)=>({id,label,icon,nodes});
const wrapPane=entry=>{
 const first=entry.nodes[0];
 if(!first?.parentElement)return null;
 const parent=first.parentElement;
 const wrap=document.createElement('div');
 wrap.className='os-functional-pane';
 wrap.dataset.osPane=entry.id;
 parent.insertBefore(wrap,first);
 for(const node of entry.nodes)wrap.append(node);
 entry.wrapper=wrap;
 return entry;
};
function build(screen,key){
 const cfg=DESCRIPTORS[key]||{kind:'single',label:'งานของฉัน',icon:'clipboard'};
 const widget=screen.querySelector('.ws-widget');
 if(!widget)return [];
 if(cfg.kind==='single'){
  if(!widget.childElementCount)return [];
  const single=pane('main',cfg.label,cfg.icon,[widget]);single.wrapper=widget;
  return [single]; // keep the existing safe workflow in one place
 }
 if(cfg.kind==='direct'){
  const host=screen.querySelector(cfg.host);
  const cards=host?[...host.querySelectorAll(cfg.selector)]:[];
  if(!cards.length)return [];
  return cards.map((card,i)=>pane(cfg.ids[i]||'task-'+i,cfg.names[i]||'หัวข้องาน',
    cfg.icons[i]||'clipboard',[card])).map(wrapPane).filter(Boolean);
 }
 if(cfg.kind==='stations'){
  const container=widget.querySelector('.os-station-layout');
  const create=container?.querySelector(':scope > .os-create-station');
  const directory=container?.querySelector(':scope > .os-station-directory');
  if(!create||!directory)return [];
  const entries=[
   pane('create','สร้างปั๊ม','user-plus',[create]),
   pane('directory','ปั๊มที่สร้างแล้ว','building',[directory])];
  const fuel=widget.querySelector(':scope > #fuel-editor');
  if(fuel)entries.push(pane('fuel','ตั้งค่าน้ำมัน','fuel',[fuel]));
  return entries.map(wrapPane).filter(Boolean);
 }
 if(cfg.kind==='billing'){
  const host=widget.querySelector('.saas-simple-layout');
  const plans=host?.querySelector(':scope > .os-plan-manager');
  const editor=host?.querySelector(':scope > #os-plan-editor');
  const tax=host?.querySelector(':scope > .os-tax-panel');
  if(!plans||!tax)return [];
  return [
   pane('plans','รายการแพ็กเกจ','receipt',[plans]),
   ...(editor?[pane('editor','เพิ่มหรือแก้ไขแพ็กเกจ','user-plus',[editor])]:[]),
   pane('tax','นโยบาย VAT','wallet',[tax])
  ].map(wrapPane).filter(Boolean);
 }
 if(cfg.kind==='ranges'){
  const host=screen.querySelector(cfg.host);
  if(!host?.children.length)return [];
  const children=[...host.children];
  const boundaries=cfg.breaks.map((group,i)=>{
   if(i===0)return 0;
   let anchor=host.querySelector(group.anchor);
   if(!anchor||anchor.parentElement!==host)return -1;
   let prev=anchor.previousElementSibling;
   if(group.previous==='H3'){
    for(let n=0;prev&&n<4;n++,prev=prev.previousElementSibling){
     if(prev.tagName==='H3'){anchor=prev;break;}
     if(prev.tagName==='FORM')break;
    }
   }else if(prev?.tagName===group.previous)anchor=prev;
   return children.indexOf(anchor);
  });
  if(boundaries.some(x=>x<0)||new Set(boundaries).size!==boundaries.length)return [];
  return cfg.breaks.map((group,i)=>{
   const nodes=children.slice(boundaries[i],boundaries[i+1]??children.length);
   return pane(group.id,group.label,group.icon,nodes);
  }).filter(p=>p.nodes.length).map(wrapPane).filter(Boolean);
 }
 return [];
}

export function installFunctionalSubmenus(root){
 const states=new Map();
 const shell=root.querySelector('[data-workspace-shell]');
 if(!shell)return;
 let queued=false,installing=false;
 const isAvailable=(state,p)=>p.wrapper?.isConnected&&
  !(state.key==='sales'&&p.nodes[0]?.hidden)&&
  !(state.key==='corporate'&&p.id!=='account'&&p.nodes[0]?.hidden)&&
  !(state.key==='stations'&&p.id==='fuel'&&!p.nodes[0]?.childElementCount);
 function show(key,id,{focus=false}={}){
  const state=states.get(key);
  if(!state)return false;
  const available=state.panes.filter(p=>isAvailable(state,p));
  const found=available.find(p=>p.id===id);
  if(!found)return false;
  state.selected=id;
  for(const p of state.panes){
   if(!p.wrapper||p.wrapper===p.nodes[0])continue;
   const active=p===found;
   if(p.wrapper.hidden===active)p.wrapper.hidden=!active;
  }
  for(const button of state.nav.querySelectorAll('button[data-os-pane-key]')){
   const active=button.dataset.osPaneKey===id;
   button.classList.toggle('active',active);
   button.setAttribute('aria-pressed',String(active));
   if(active)button.setAttribute('aria-current','true');
   else button.removeAttribute('aria-current');
  }
  if(focus)state.nav.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  return true;
 }
 function syncState(state){
  const available=state.panes.filter(p=>p.wrapper?.isConnected&&
    !p.nodes[0]?.hidden&&(p.id!=='fuel'||p.nodes[0]?.childElementCount));
  const signature=available.map(p=>p.id).join('|');
  if(state.signature!==signature){
   state.signature=signature;
   const frag=document.createDocumentFragment();
   for(const p of available){
    const button=document.createElement('button');
    button.type='button';button.className='os-category-tab os-nav-orb-item';
    button.dataset.osPaneKey=p.id;
    button.setAttribute('aria-label',p.label);
    button.title=p.label;
    const orb=document.createElement('span');orb.className='os-nav-orb';
    orb.append(makeIcon(p.icon));
    const caption=document.createElement('span');caption.className='os-nav-caption';
    caption.textContent=p.label;button.append(orb,caption);
    button.addEventListener('click',()=>{
      show(state.key,p.id,{focus:true});
      const form=p.wrapper?.querySelector('form[data-os-create-ready="true"]');
      if(form?.closest('.os-functional-pane')===p.wrapper&&form.hidden){
       form.dispatchEvent(new Event('os:prepare-create'));
       form.dispatchEvent(new Event('os:create-show'));
      }
    });
    frag.append(button);
   }
   state.nav.replaceChildren(frag);
  }
  if(!available.some(p=>p.id===state.selected)){
   const preferred=available.find(p=>p.id===state.start)||available[0];
   state.selected=preferred?.id||null;
  }
  if(state.selected){
   show(state.key,state.selected);
   // The initial creation pane must contain its actual form, not an empty card.
   if(state.key==='customers'||state.key==='hr'){
    const active=available.find(p=>p.id===state.selected);
    const form=active?.wrapper?.querySelector('form[data-os-create-ready="true"]');
    if(form?.hidden)form.dispatchEvent(new Event('os:create-show'));
   }
  }
 }
 function reconcile(){
  if(installing)return;
  installing=true;
  try{
   for(const screen of root.querySelectorAll('[data-ws-screen]')){
    const key=screen.dataset.wsScreen;
    if(key==='overview')continue;
    const nav=root.querySelector('[data-context-for="'+key+'"] [data-os-functional-menu]');
    if(!nav)continue;
    let state=states.get(key);
    if(!state||!state.panes.some(p=>p.wrapper?.isConnected)){
     const panes=build(screen,key);
     if(!panes.length)continue;
     state={key,panes,nav,selected:state?.selected||null,
      start:DESCRIPTORS[key]?.start||panes[0].id,signature:null};
     states.set(key,state);
    }
    syncState(state);
   }
  }finally{installing=false;}
 }
 const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;queueMicrotask(()=>{queued=false;reconcile();});
 });
 observer.observe(shell,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 shell.addEventListener('oilstation:open-pane',event=>{
  const screen=event.target.closest?.('[data-ws-screen]');
  if(!screen)return;
  const key=screen.dataset.wsScreen;
  reconcile();
  const requested=event.detail?.key;
  if(requested)show(key,requested,{focus:true});
  else if(event.detail?.element){
   const state=states.get(key);
   const p=state?.panes.find(p=>p.wrapper?.contains(event.detail.element));
   if(p)show(key,p.id);
  }
 });
 queueMicrotask(reconcile);
 return {reconcile,disconnect:()=>observer.disconnect()};
}
