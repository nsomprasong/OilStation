/** Pure review contract; no proration calculation or mutation. */
export function assessSaasProrationConsent({switchMode,consent,creditSatang,chargeSatang}){
 if(!['next_renewal','future_renewal','immediate'].includes(switchMode))
  throw new TypeError('invalid switch mode');
 if(switchMode!=='immediate')return Object.freeze({approved:false,reason:'no_midcycle_proration_needed'});
 const cash=s=>typeof s==='string'&&/^(0|[1-9]\d{0,11})$/.test(s);
 if(!cash(creditSatang)||!cash(chargeSatang))throw new RangeError('invalid proration quote');
 if(!consent||consent.accepted!==true||consent.policyVersion!=='proration-v1'||
  typeof consent.quoteId!=='string'||!/^[a-zA-Z0-9_-]{8,64}$/.test(consent.quoteId))
  return Object.freeze({approved:false,reason:'explicit_consent_or_quote_missing'});
 return Object.freeze({approved:false,reason:'immediate_switch_not_implemented',
  quoteId:consent.quoteId,creditSatang,chargeSatang});
}
