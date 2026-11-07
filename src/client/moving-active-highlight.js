/**
 * Design Skills Library ANM-NAV-001 — Moving Active Highlight v1.0.0.
 * One persistent backdrop glides between authorized navigation items.
 * Visual-only: navigation permission, route, loading and aria state remain
 * owned by the caller. Does not add global click listeners.
 *
 * Reference: nsomprasong/design-skills-library @ v0.6.0
 */
export function installMovingActiveHighlight(rail,{
 selector='button[data-ws-go]',keyAttribute='wsGo',layout='horizontal',fromRect=null,
}={}){
 if(!rail)return null;
 // Old-CSS browser fixtures do not yet have .os-moving-active-rail.
 // Anchor the absolute layer to this rail to prevent page overflow on 320px.
 const priorInlinePosition=rail.style.position;
 if(getComputedStyle(rail).position==='static')rail.style.position='relative';
 const indicator=document.createElement('span');
 indicator.className='os-moving-active-indicator';
 indicator.setAttribute('aria-hidden','true');
 // Fail safe even when the page is running an older CSS bundle, as in
 // isolated browser fixtures: the visual layer must never block clicks.
 indicator.style.position='absolute';
 indicator.style.pointerEvents='none';
 indicator.hidden=true;
 rail.classList.add('os-moving-active-rail');
 rail.dataset.osHighlightLayout=layout;
 rail.prepend(indicator);
 let key=null,hasPosition=false,frame=0,observed=null;
 let lastRailWidth=0,lastRailHeight=0,lastButtonWidth=0,lastButtonHeight=0;
 const motionReduced=()=>typeof matchMedia==='function'&&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
 const getButton=value=>[...rail.querySelectorAll(selector)].find(button=>
  button.dataset[keyAttribute]===value&&!button.disabled&&!button.hidden);
 const geometry=rect=>{
  const r=rail.getBoundingClientRect();
  if(!r.width||!r.height||!rect.width||!rect.height)return null;
  return {
   x:rect.left-r.left+rail.scrollLeft-rail.clientLeft,
   y:rect.top-r.top+rail.scrollTop-rail.clientTop,
   w:rect.width,h:rect.height,
  };
 };
 function apply(g,snap=false){
  if(!g){
   indicator.hidden=true;rail.dataset.osHighlightReady='false';
   hasPosition=false;return false;
  }
  const instant=snap||!hasPosition||motionReduced();
  if(instant)indicator.style.transition='none';
  indicator.hidden=false;
  indicator.style.width=g.w+'px';
  indicator.style.height=g.h+'px';
  indicator.style.transform='translate3d('+g.x+'px,'+g.y+'px,0)';
  rail.dataset.osHighlightReady='true';
  if(instant){
   // Start geometry must be painted before enabling the next transition.
   void indicator.offsetWidth;
   indicator.style.removeProperty('transition');
  }
  hasPosition=true;
  return true;
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{
  if(key===null)return;
  const railRect=rail.getBoundingClientRect();
  const selected=getButton(key);
  const targetRect=selected?.getBoundingClientRect();
  if(!targetRect)return;
  // ResizeObserver delivers an initial notification whenever we observe a
  // *new* active button. It is NOT a resize: snapping here would cancel the
  // 520ms A→B transition on every click.
  const changed=Math.abs(railRect.width-lastRailWidth)>.5||
   Math.abs(railRect.height-lastRailHeight)>.5||
   Math.abs(targetRect.width-lastButtonWidth)>.5||
   Math.abs(targetRect.height-lastButtonHeight)>.5;
  if(!changed)return;
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>align(true));
 }):null;
 function align(snap=false){
  if(key===null)return false;
  const target=getButton(key);
  if(!target)return apply(null);
  if(observer&&observed!==target){
   if(observed)observer.unobserve(observed);
   observed=target;observer.observe(target);
  }
  const box=target.getBoundingClientRect();
  const container=rail.getBoundingClientRect();
  lastRailWidth=container.width;lastRailHeight=container.height;
  lastButtonWidth=box.width;lastButtonHeight=box.height;
  return apply(geometry(box),snap);
 }
 function select(next,{snap=false}={}){
  if(typeof next!=='string'||!next)return apply(null);
  // A destination not in a permission-filtered dock must never leave another
  // destination falsely highlighted.
  key=next;
  return align(snap);
 }
 function onKeys(event){
  const origin=event.target.closest?.(selector);
  if(!origin||!rail.contains(origin)||
    event.altKey||event.metaKey||event.ctrlKey)return;
  const items=[...rail.querySelectorAll(selector)].filter(button=>
   !button.disabled&&!button.hidden);
  const index=items.indexOf(origin);
  if(index<0||items.length<2)return;
  const prev=layout==='vertical'?'ArrowUp':'ArrowLeft';
  const next=layout==='vertical'?'ArrowDown':'ArrowRight';
  const dest=event.key==='Home'?0:event.key==='End'?items.length-1:
   event.key===prev?(index-1+items.length)%items.length:
   event.key===next?(index+1)%items.length:-1;
  if(dest<0)return;
  event.preventDefault();
  items[dest].focus({preventScroll:true});
  items[dest].click(); // Use the existing authorized navigation handler.
 }
 rail.addEventListener('keydown',onKeys);
 observer?.observe(rail);
 if(fromRect&&geometry(fromRect))apply(geometry(fromRect),true);
 else{
  const current=[...rail.querySelectorAll(selector)].find(button=>
   button.hasAttribute('aria-current')||button.getAttribute('aria-pressed')==='true');
  if(current)select(current.dataset[keyAttribute],{snap:true});
 }
 return {
  select,align,
  get current(){return key;},
  get hasPosition(){return hasPosition;},
  dispose(){
   cancelAnimationFrame(frame);
   observer?.disconnect();
   rail.removeEventListener('keydown',onKeys);
   indicator.remove();
   rail.classList.remove('os-moving-active-rail');
   rail.style.position=priorInlinePosition;
   delete rail.dataset.osHighlightReady;
   delete rail.dataset.osHighlightLayout;
  },
 };
}
