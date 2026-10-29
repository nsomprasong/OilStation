import { paidStripeEvidence } from '../domain/stripe-reconciliation.mjs';
/** Stripe raw-byte webhook inbox. No event here credits wallets or invoices. */
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
}});
const MAX=256*1024;
function parseSignature(header){
 if(typeof header!=='string'||header.length>3000)return null;
 const parts=header.split(',').map(s=>s.trim().split('='));
 const timestamps=parts.filter(s=>s[0]==='t'&&s.length===2);
 const signatures=parts.filter(s=>s[0]==='v1'&&s.length===2&&/^[0-9a-f]{64}$/i.test(s[1]));
 if(timestamps.length!==1||!/^\d{10,11}$/.test(timestamps[0][1])||!signatures.length)return null;
 return {timestamp:Number(timestamps[0][1]),signatures:signatures.map(s=>s[1])};
}
async function readBounded(request){
 const len=Number(request.headers.get('content-length'));
 if(Number.isFinite(len)&&len>MAX)return null;
 const reader=request.body?.getReader();
 if(!reader)return null;
 const chunks=[];let count=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   count+=value.byteLength;
   if(count>MAX){await reader.cancel();return null;}
   chunks.push(value);
  }
  const bytes=new Uint8Array(count);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
 }catch{return null;}finally{reader.releaseLock();}
}
export async function verifyStripeSignature(raw,header,secret,nowSeconds=Math.floor(Date.now()/1000)){
 if(!(raw instanceof Uint8Array)||!secret||typeof secret!=='string'||secret.length<20)return false;
 const parsed=parseSignature(header);
 if(!parsed||!Number.isFinite(nowSeconds)||Math.abs(nowSeconds-parsed.timestamp)>300)return false;
 const prefix=new TextEncoder().encode(String(parsed.timestamp)+'.');
 const bytes=new Uint8Array(prefix.length+raw.length);
 bytes.set(prefix);bytes.set(raw,prefix.length);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const sig of parsed.signatures){
  const signature=Uint8Array.from(sig.match(/../g),h=>Number.parseInt(h,16));
  if(await crypto.subtle.verify('HMAC',key,signature,bytes))return true;
 }
 return false;
}
export function createStripeWebhookApi({db,secret,processTestPayments=false,nowSeconds=()=>Math.floor(Date.now()/1000)}){
 return async request=>{
  if(new URL(request.url).pathname!=='/api/webhooks/stripe')return json(404,{error:'not_found'});
  if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  if(!secret)return json(503,{error:'billing_not_configured'});
  const raw=await readBounded(request);
  if(!raw)return json(413,{error:'body_too_large'});
  const ok=await verifyStripeSignature(raw,request.headers.get('stripe-signature'),secret,nowSeconds());
  if(!ok)return json(400,{error:'invalid_signature'});
  let event;
  try{event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}
  catch{return json(400,{error:'invalid_json'});}
  if(typeof event?.id!=='string'||!/^evt_[A-Za-z0-9]{6,100}$/.test(event.id)||
     typeof event?.type!=='string'||!/^[a-z][a-z0-9_.]{2,90}$/.test(event.type)||
     typeof event?.livemode!=='boolean'||event.livemode===true)
    return json(422,{error:'unsupported_event'});
  const hashBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
  const hash=[...hashBytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  try{
   const result=await db.recordStripeEvent({eventId:event.id,eventType:event.type,
      hash,livemode:event.livemode});
   // Never ACK successful Stripe payment without a reconciler: an ACK prevents
   // automatic Stripe retries and could leave a paid invoice marked unpaid.
   if(event.type==='payment_intent.succeeded'&&!processTestPayments)
     return json(503,{error:'reconciliation_disabled'});
   if(processTestPayments&&event.type==='payment_intent.succeeded'){
     let proof;
     try{proof=paidStripeEvidence(event);}catch{
      return json(422,{error:'payment_evidence_invalid'});
     }
     if(!proof)return json(422,{error:'payment_evidence_invalid'});
     // The DB requires the exact pre-bound PaymentIntent and amounts.
     // No browser success redirect, spoofed metadata or wallet credit is trusted.
     const paid=await db.reconcileSaasPaid(proof);
     return json(200,{received:true,replayed:paid?.replayed===true,
       invoiceStatus:paid?.status});
   }
   return json(200,{received:true,replayed:result?.replayed===true});
  }catch(e){
   if(e?.code==='IDEMPOTENCY_CONFLICT')return json(409,{error:'event_conflict'});
   return json(503,{error:'event_inbox_unavailable'});
  }
 };
}
