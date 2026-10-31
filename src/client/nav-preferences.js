/** Only screen keys are stored. Permission filtering happens on every render. */
export const NAV_USAGE_LIMIT=10000;
export function selectFrequentScreens(screens,counts={},limit=4){
 const allowed=screens.filter(s=>s.key!=='overview');
 const score=k=>Number.isInteger(counts?.[k])&&counts[k]>0?Math.min(NAV_USAGE_LIMIT,counts[k]):0;
 return allowed.map((screen,index)=>({screen,index,weight:score(screen.key)}))
  .sort((a,b)=>b.weight-a.weight||a.index-b.index)
  .slice(0,limit).map(x=>x.screen);
}
export function incrementNavUsage(counts={},key){
 if(typeof key!=='string'||!key||key==='overview')return {...counts};
 const values=Object.fromEntries(Object.entries(counts).filter(([k,v])=>
  /^[a-z_-]{2,35}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=NAV_USAGE_LIMIT));
 if((values[key]||0)>=NAV_USAGE_LIMIT){
  for(const name of Object.keys(values))values[name]=Math.floor(values[name]/2);
 }
 values[key]=(values[key]||0)+1;
 return values;
}
export function readNavUsage(userId,store=globalThis.localStorage){
 if(!userId||!store)return {};
 try{
  const obj=JSON.parse(store.getItem('oilstation_nav_frequency_v1:'+userId)||'{}');
  if(!obj||Array.isArray(obj)||typeof obj!=='object')return {};
  return Object.fromEntries(Object.entries(obj).filter(([k,v])=>
   /^[a-z_-]{2,35}$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=NAV_USAGE_LIMIT));
 }catch{return {};}
}
export function saveNavUsage(userId,counts,store=globalThis.localStorage){
 if(!userId||!store)return false;
 try{store.setItem('oilstation_nav_frequency_v1:'+userId,JSON.stringify(counts));return true;}
 catch{return false;}
}
