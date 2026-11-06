/** Pure QA evidence evaluator; cannot deploy or enable financial release. */
export const SAAS_SWITCH_GATES=Object.freeze([
 'owner_scope','monthly_to_yearly','yearly_to_monthly','future_start',
 'timezone_boundary','idempotent_schedule','cancel_reschedule',
 'invoice_immutable','payment_recovery','atomic_entitlements',
 'production_counter_invariance','reversible_fixture',
]);
export function assessSaasSwitchReleaseEvidence({evidence}){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
  throw new TypeError('evidence map required');
 const missing=SAAS_SWITCH_GATES.filter(name=>{
  const v=evidence[name];
  return !v||v.outcome!=='PASS'||typeof v.runUrl!=='string'||
   !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/.test(v.runUrl)||
   typeof v.commitSha!=='string'||!/^[0-9a-f]{40}$/.test(v.commitSha);
 });
 return Object.freeze({readyForManualReleaseReview:missing.length===0,
  missing:Object.freeze(missing),decision:'MANUAL_REVIEW_REQUIRED_NOT_AUTO_RELEASE'});
}
