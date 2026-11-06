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
  const raw=x.effectiveAt;
  const m=typeof raw==='string'&&/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(raw);
  const day=m?new Date(m[1]+'T00:00:00Z'):null;
  const valid=!!m&&Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===m[1]&&
   Number(m[2])<24&&Number(m[3])<60&&Number(m[4])<60&&
   Number(m[7]||0)<=14&&Number(m[8]||0)<60&&
   !(Number(m[7]||0)===14&&Number(m[8]||0)!==0);
  const time=valid?Date.parse(raw):NaN;
  const status=STATUS.has(x.status)?x.status:'unknown';
  const paymentStatus=PAYMENT.has(x.paymentStatus)?x.paymentStatus:'unknown';
  return Object.freeze({name:names.get(x.nextPlanId)||'แพ็กเกจใหม่',status,
   paymentStatus,effectiveAt:Number.isFinite(time)?new Date(time).toISOString():null,
   viewOnly:true});
 }));
}
