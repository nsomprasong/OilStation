/** Pure optimistic guard; DB row locks / version checks still required. */
const DATE=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/;
function parsedInstant(value){
 const m=typeof value==='string'&&DATE.exec(value);
 if(!m)throw new RangeError('invalid period snapshot');
 const d=new Date(m[1]+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==m[1]||
 Number(m[2])>23||Number(m[3])>59||Number(m[4])>59||
 Number(m[7]||0)>14||Number(m[8]||0)>59||
 (Number(m[7]||0)===14&&Number(m[8]||0)!==0))
  throw new RangeError('invalid period snapshot');
 const timestamp=Date.parse(value);
 if(!Number.isFinite(timestamp))throw new RangeError('invalid period snapshot');
 return timestamp;
}
export function compareSaasSwitchSnapshot({expected,actual}){
 if(!expected||!actual)throw new TypeError('missing subscription snapshot');
 const keys=['id','stationId','planId','status','startsAt','periodEnd'];
 for(const key of keys)if(typeof expected[key]!=='string'||typeof actual[key]!=='string')
  throw new TypeError('incomplete subscription snapshot');
 const expectedStart=parsedInstant(expected.startsAt),actualStart=parsedInstant(actual.startsAt);
 const expectedEnd=parsedInstant(expected.periodEnd),actualEnd=parsedInstant(actual.periodEnd);
 if(expectedStart>=expectedEnd||actualStart>=actualEnd)
  throw new RangeError('invalid subscription term');
 const fields=['id','stationId','planId','status','startsAt'];
 const stale=fields.some(k=>expected[k]!==actual[k])||
  expectedEnd!==actualEnd;
 return Object.freeze({matches:!stale,reason:stale?'stale_subscription_snapshot':'snapshot_matches'});
}
