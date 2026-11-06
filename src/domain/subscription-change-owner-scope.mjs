/** Pure guard only. SQL must revalidate membership in same transaction. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertSaasSwitchOwner({actorId,stationId,memberships}){
 if(!UUID.test(actorId||'')||!UUID.test(stationId||''))throw new TypeError('invalid scope identifiers');
 if(!Array.isArray(memberships))throw new TypeError('memberships unavailable');
 const allowed=memberships.some(m=>m?.active===true&&m.scope_type==='station'&&
  m.station_id===stationId&&m.user_id===actorId&&
  (m.role_code==='station_owner'||m.role_code==='owner'));
 if(!allowed)throw new RangeError('station owner permission denied');
 return Object.freeze({actorId,stationId,authorized:true});
}
