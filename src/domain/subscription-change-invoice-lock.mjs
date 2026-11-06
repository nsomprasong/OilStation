/** Immutable invoice protection preview; never writes invoice rows. */
const CASH=/^(0|[1-9]\d{0,11})$/;
export function assessSaasInvoiceImmutability({original,proposed}){
 if(!original||!proposed)throw new TypeError('invoice snapshot missing');
 const keys=['id','stationId','billingPeriodStart','billingPeriodEnd','totalSatang','currency','status'];
 for(const k of keys)if(typeof original[k]!=='string'||typeof proposed[k]!=='string')
  throw new TypeError('invalid invoice snapshot');
 if(!CASH.test(original.totalSatang)||!CASH.test(proposed.totalSatang))
  throw new RangeError('invalid invoice amount');
 const paid=original.status==='paid'||original.status==='issued';
 const changed=keys.some(k=>original[k]!==proposed[k]);
 return Object.freeze({allowed:!paid&&!changed,
  reason:paid?'issued_invoice_is_immutable':changed?'invoice_revision_requires_separate_credit_note':'unchanged_draft',
  financialMutation:false});
}
