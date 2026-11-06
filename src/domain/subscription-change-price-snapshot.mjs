/** Pure immutable quote snapshot; does not authorize or issue an invoice. */
const MONEY=/^(0|[1-9][0-9]{0,11})$/;
const amount=(s,name)=>{
 if(typeof s!=='string'||!MONEY.test(s))throw new RangeError('invalid '+name+' satang');
 return BigInt(s);
};
export function buildSaasSwitchPriceSnapshot({subtotalSatang,discountSatang,vatSatang,totalSatang,paymentMethod,quoteVersion}){
 if(!['card','promptpay'].includes(paymentMethod))throw new TypeError('invalid payment method');
 if(typeof quoteVersion!=='string'||!/^[a-zA-Z0-9_-]{8,64}$/.test(quoteVersion))
  throw new TypeError('missing price quote version');
 const base=amount(subtotalSatang,'subtotal');
 const discount=amount(discountSatang,'discount');
 const tax=amount(vatSatang,'vat');
 const total=amount(totalSatang,'total');
 if(discount>base||base-discount+tax!==total)throw new RangeError('price sum mismatch');
 return Object.freeze({subtotalSatang:base.toString(),discountSatang:discount.toString(),
  vatSatang:tax.toString(),totalSatang:total.toString(),paymentMethod,quoteVersion,
  status:'QUOTE_ONLY_NOT_INVOICE'});
}
