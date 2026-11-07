/**
 * OilStation station-card -> station-details shared-element style transition.
 *
 * The selected card's edit ICON is the geometry origin in both directions.
 * We animate the real detail panel with WAAPI (no clones, timers driving UI,
 * MutationObservers, global listeners, or changes to routing/permissions).
 * All failures, reduced-motion, missing origins and old browsers snap safely.
 */
function geometry(rect){
 if(!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
    !(rect.width>0) || !(rect.height>0))return null;
 return {x:rect.x,y:rect.y,width:rect.width,height:rect.height};
}

export function editIconRect(button){
 return geometry(button?.getBoundingClientRect?.());
}

export function stationMorphFrames(origin, panelRect, direction='open'){
 const source=geometry(origin),dest=geometry(panelRect);
 if(!source||!dest)return null;
 const x=(source.x+source.width/2)-(dest.x+dest.width/2);
 const y=(source.y+source.height/2)-(dest.y+dest.height/2);
 const scale=Math.max(.045,Math.min(.2,source.width/dest.width,
   source.height/dest.height));
 const collapsed={
  transform:`translate3d(${x}px,${y}px,0) scale(${scale})`,
  opacity:.24,clipPath:'inset(0% round 1000px)',
 };
 const expanded={
  transform:'translate3d(0px,0px,0) scale(1)',
  opacity:1,clipPath:'inset(0% round 0px)',
 };
 return direction==='close'?[expanded,collapsed]:[collapsed,expanded];
}

export function canMorph(panel,origin){
 if(!panel?.isConnected||!editIconRect({getBoundingClientRect:()=>origin}))return false;
 const view=panel.ownerDocument?.defaultView;
 return !!(typeof panel.animate==='function'&&
  !view?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

/**
 * Returns once the transition is settled. It is safe to remove/hide the
 * panel immediately afterward. A bounded timeout guards against animations
 * stalled by background-tab throttling, and cancel cleans inline animation
 * state even after navigation.
 */
export async function morphStationDetails(panel,origin,{direction='open'}={}){
 if(!canMorph(panel,origin))return false;
 const frames=stationMorphFrames(origin,panel.getBoundingClientRect(),direction);
 if(!frames)return false;
 const duration=direction==='close'?350:460;
 let anim,timer;
 panel.classList.add('os-station-morphing');
 try{
  anim=panel.animate(frames,{
   duration,easing:direction==='close'?'cubic-bezier(.5,0,.8,.2)':
    'cubic-bezier(.19,1,.22,1)',fill:'both',
  });
  await Promise.race([
   anim.finished.catch(()=>{}),
   new Promise(resolve=>{timer=setTimeout(resolve,duration+180);}),
  ]);
  return true;
 }catch{
  return false;
 }finally{
  if(timer!==undefined)clearTimeout(timer);
  try{anim?.cancel();}catch{}
  panel.classList.remove('os-station-morphing');
 }
}
