/** Pure optimistic guard; DB row locks / version checks still required. */
const DATE=/^\d{4}-\d{2}-\d{2}T/;
export function compareSaasSwitchSnapshot({expected,actual}){
 if(!expected||!actual)throw new TypeError('missing subscription snapshot');
 const keys=['id','stationId','planId','status','startsAt','periodEnd'];
 for(const key of keys)if(typeof expected[key]!=='string'||typeof actual[key]!=='string')
  throw new TypeError('incomplete subscription snapshot');
 if(!DATE.test(expected.periodEnd)||!Number.isFinite(Date.parse(expected.periodEnd))||
  !DATE.test(actual.periodEnd)||!Number.isFinite(Date.parse(actual.periodEnd)))
  throw new RangeError('invalid period snapshot');
 const fields=['id','stationId','planId','status','startsAt'];
 const stale=fields.some(k=>expected[k]!==actual[k])||
  Date.parse(expected.periodEnd)!==Date.parse(actual.periodEnd);
 return Object.freeze({matches:!stale,reason:stale?'stale_subscription_snapshot':'snapshot_matches'});
}
