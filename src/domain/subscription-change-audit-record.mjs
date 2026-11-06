/** Pure audit record builder; does not write audit_events. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=new Set(['scheduled','cancelled','payment_confirmed','activation_blocked','applied']);
export function buildSaasTransitionAudit({actorId,stationId,requestId,kind,occurredAtUtc,previousPlanId,nextPlanId}){
 if(![actorId,stationId,requestId,previousPlanId,nextPlanId].every(x=>UUID.test(x||'')))
  throw new TypeError('invalid audit identity');
 if(previousPlanId===nextPlanId||!kinds.has(kind))throw new RangeError('invalid audit transition');
 if(typeof occurredAtUtc!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(occurredAtUtc)||
  !Number.isFinite(Date.parse(occurredAtUtc)))throw new TypeError('invalid audit instant');
 return Object.freeze({actorId,stationId,requestId,kind,
  occurredAtUtc:new Date(occurredAtUtc).toISOString(),
  previousPlanId,nextPlanId,financialMutation:false,recordType:'saas_switch_audit_proposal'});
}
