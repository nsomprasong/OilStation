/** Pure, bounded history shaping. Display only; not permission enforcement. */
const STATUS=new Set(['pending','cancelled','applied','failed']);
const PAYMENT=new Set(['unconfirmed','confirmed','failed']);
const label=(value)=>typeof value==='string'&&value.length<=80?value:'—';
export function shapeSaasOwnerChangeHistory({rows,plans,maxItems=20}){
 if(!Array.isArray(rows)||!Array.isArray(plans))throw new TypeError('invalid history response');
 if(!Number.isInteger(maxItems)||maxItems<1||maxItems>20)throw new RangeError('invalid history limit');
 const names=new Map(plans.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>[p.id,label(p.name)]));
 return Object.freeze(rows.slice(0,maxItems).map(x=>{
  if(!x||typeof x!=='object')throw new TypeError('invalid history row');
  const time=typeof x.effectiveAt==='string'?Date.parse(x.effectiveAt):NaN;
  const status=STATUS.has(x.status)?x.status:'unknown';
  const paymentStatus=PAYMENT.has(x.paymentStatus)?x.paymentStatus:'unknown';
  return Object.freeze({name:names.get(x.nextPlanId)||'แพ็กเกจใหม่',status,
   paymentStatus,effectiveAt:Number.isFinite(time)?new Date(time).toISOString():null,
   viewOnly:true});
 }));
}
