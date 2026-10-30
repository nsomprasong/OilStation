/** Integer-satang subscription billing quote; never charges customers.
 * A reviewed tax regime and price rule snapshot must be supplied externally.
 */
const satang=(x,k)=>{
 if(typeof x!=='bigint'||x<0n||x>999_999_999_999_999n)
   throw new RangeError('invalid '+k);
 return x;
};
const bp=(x,k)=>{
 if(!Number.isInteger(x)||x<0||x>10_000)throw new RangeError('invalid '+k);
 return BigInt(x);
};
const pct=(amount,basisPoints)=> (amount*basisPoints+5000n)/10000n;
export function quoteSubscription({lines,promotion=null,paymentMethod,tax}){
 if(!Array.isArray(lines)||!lines.length||lines.length>100)
   throw new RangeError('invoice lines required');
 if(!['card','promptpay'].includes(paymentMethod))throw new TypeError('invalid payment method');
 if(!tax||!['inclusive','exclusive'].includes(tax.mode))
   throw new TypeError('reviewed tax configuration required');
 const taxBp=bp(tax.rateBasisPoints,'tax rate');
 const amounts=lines.map(line=>{
  if(!line||typeof line.moduleCode!=='string'||!/^[-a-z0-9_]{2,40}$/.test(line.moduleCode))
   throw new TypeError('invalid module');
  if(!Number.isInteger(line.quantity)||line.quantity<0||line.quantity>100000)
   throw new RangeError('invalid quantity');
  const unit=satang(line.unitPriceSatang,'price');
  const amount=unit*BigInt(line.quantity);
  if(amount>999_999_999_999_999n)throw new RangeError('line overflow');
  return {moduleCode:line.moduleCode,quantity:line.quantity,unitPriceSatang:unit,
    amountSatang:amount};
 });
 const subtotal=amounts.reduce((sum,item)=>sum+item.amountSatang,0n);
 if(subtotal>999_999_999_999_999n)throw new RangeError('invoice overflow');
 let promotionDiscount=0n;
 if(promotion!==null){
  if(promotion.type==='fixed'){
   promotionDiscount=satang(promotion.amountSatang,'promotion');
  }else if(promotion.type==='percent'){
   promotionDiscount=pct(subtotal,bp(promotion.basisPoints,'promotion rate'));
  }else throw new TypeError('invalid promotion');
 }
 if(promotionDiscount>subtotal)promotionDiscount=subtotal;
 const afterPromotion=subtotal-promotionDiscount;
 // PromptPay alone gets the agreed 2% discount; cards receive none.
 const qrDiscount=paymentMethod==='promptpay'?pct(afterPromotion,200n):0n;
 const afterDiscount=afterPromotion-qrDiscount;
 const taxAmount=tax.mode==='exclusive'?pct(afterDiscount,taxBp):
  (afterDiscount*taxBp+(10000n+taxBp)/2n)/(10000n+taxBp);
 const total=tax.mode==='exclusive'?afterDiscount+taxAmount:afterDiscount;
 if(total>999_999_999_999_999n)throw new RangeError('invoice overflow');
 return {lines:amounts,subtotalSatang:subtotal,
  promotionDiscountSatang:promotionDiscount,qrDiscountSatang:qrDiscount,
  discountSatang:promotionDiscount+qrDiscount,taxSatang:taxAmount,
  totalSatang:total,vatMode:tax.mode,paymentMethod};
}
