/** Pure scheduler preflight. No transition is activated or persisted here. */
const allowed=new Set(['pending','cancelled','applied','failed']);
export function selectDueSaasChanges({intents,nowUtc,limit=25}){
 if(!Array.isArray(intents)||intents.length>1000)throw new RangeError('invalid intent input');
 if(typeof nowUtc!=='string'||!Number.isFinite(Date.parse(nowUtc)))throw new RangeError('invalid clock');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new RangeError('invalid batch limit');
 const now=Date.parse(nowUtc),seen=new Set();
 const due=intents.filter(row=>{
  if(!row||!allowed.has(row.status)||typeof row.stationId!=='string'||
   typeof row.effectiveAtUtc!=='string'||!Number.isFinite(Date.parse(row.effectiveAtUtc)))
   throw new TypeError('invalid intent row');
  return row.status==='pending'&&Date.parse(row.effectiveAtUtc)<=now;
 }).sort((a,b)=>Date.parse(a.effectiveAtUtc)-Date.parse(b.effectiveAtUtc)||
  a.stationId.localeCompare(b.stationId));
 const result=[];
 for(const row of due){
  if(seen.has(row.stationId))throw new RangeError('duplicate pending station transition');
  seen.add(row.stationId);
  if(result.length<limit)result.push(Object.freeze({stationId:row.stationId,
   requestId:row.id,effectiveAtUtc:row.effectiveAtUtc}));
 }
 return Object.freeze(result);
}
