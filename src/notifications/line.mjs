/**
 * LINE Official Account push transport. No personal/finance details in push text.
 * The link always requires normal OilStation login before any approval.
 */
const EVENTS={
 topup_pending:'มีคำขอเติมเงินรอตรวจสอบใน OilStation',
 topup_approved:'สถานะคำขอเติมเงินมีการเปลี่ยนแปลง',
 shift_substitution_pending:'มีคำขอเปลี่ยนกะรอตรวจสอบ',
 overtime_pending:'มีคำขอทำงานล่วงเวลารอตรวจสอบ',
 subscription_due:'มีรายการสมัครใช้งานที่ต้องดำเนินการ',
 attendance_review_pending:'มีคำขอลงเวลารอตรวจสอบ',
};
const RETRY=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER=/^U[0-9a-f]{32}$/i;
export function makeLineMessage(eventType){
 const title=EVENTS[eventType];
 if(!title)return null;
 return {messages:[{type:'text',text:title+'\nเข้าสู่ระบบเพื่อตรวจสอบ: https://oilstation.goldensoft.cloud/'}]};
}
export function createLinePush({accessToken,fetchImpl=fetch}){
 return async ({recipientId,retryKey,eventType})=>{
  if(typeof accessToken!=='string'||accessToken.length<20)
    throw new Error('line_not_configured');
  if(!USER.test(recipientId)||!RETRY.test(retryKey))
    throw new Error('invalid_line_target');
  const msg=makeLineMessage(eventType);
  if(!msg)throw new Error('unsupported_line_event');
  const response=await fetchImpl('https://api.line.me/v2/bot/message/push',{
    method:'POST',headers:{
      authorization:'Bearer '+accessToken,'content-type':'application/json',
      'x-line-retry-key':retryKey,
    },
    body:JSON.stringify({to:recipientId,...msg}),signal:AbortSignal.timeout(10_000),
  });
  if(response.ok || (response.status===409&&response.headers.get('x-line-accepted-request-id')))
    return {accepted:true};
  if(response.status===429||response.status>=500)return {accepted:false,retry:true};
  return {accepted:false,retry:false};
 };
}
export async function drainLineNotifications({db,accessToken,limit=10,fetchImpl=fetch}){
 if(!Number.isInteger(limit)||limit<1||limit>20)throw new RangeError('invalid_limit');
 if(typeof accessToken!=='string'||accessToken.length<20)return {skipped:true};
 const messages=await db.claimLineNotifications(limit);
 const push=createLinePush({accessToken,fetchImpl});
 let accepted=0,failed=0;
 for(const n of messages||[]){
  const safe=makeLineMessage(n.eventType);
  if(!safe){await db.finishLineNotification(n.id,'cancel');failed++;continue;}
  let decision='retry';
  try{
   const result=await push({recipientId:n.lineUserId,retryKey:n.id,eventType:n.eventType});
   decision=result.accepted?'sent':result.retry?'retry':'cancel';
  }catch{} // Timeout is ambiguous, so reuse the SAME retry key.
  await db.finishLineNotification(n.id,decision);
  if(decision==='sent')accepted++;else failed++;
 }
 return {accepted,failed};
}
