// Optional email; provider acceptance never means delivery/identity verification.
const EMAIL=/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
export async function sendInvitationEmail({
 env,email,inviteUrl,id,expiresAt,fetchImpl=fetch,
}){
 if(!EMAIL.test(email??'')||!UUID.test(id??'')||
    !/^https:\/\/oilstation\.goldensoft\.cloud\/invite\/[A-Za-z0-9_-]{32,128}$/.test(inviteUrl??'')||
    !Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())
  return {delivery:'manual',deliveryStatus:'invalid_invitation'};
 if(env?.INVITATION_EMAIL_ENABLED!=='true')
  return {delivery:'manual',deliveryStatus:'not_enabled'};
 const from=env?.INVITATION_FROM_EMAIL,key=env?.RESEND_API_KEY;
 if(typeof from!=='string'||!EMAIL.test(from)||
  typeof key!=='string'||!/^re_[A-Za-z0-9_]{12,}$/.test(key))
  return {delivery:'manual',deliveryStatus:'not_configured'};
 const expires=new Date(expiresAt).toLocaleString('th-TH',{
   timeZone:'Asia/Bangkok',dateStyle:'long',timeStyle:'short'
 });
 const payload={
  from,to:[email],subject:'คำเชิญเข้าใช้งาน OilStation',
  text:'คุณได้รับคำเชิญให้เข้าร่วม OilStation\n\n'+
   'ลิงก์ยืนยันคำเชิญ: '+inviteUrl+'\nหมดอายุ: '+expires+
   ' (เวลาไทย)\nหากไม่ได้ร้องขอคำเชิญ กรุณาไม่เปิดลิงก์นี้',
  html:'<div lang="th" style="font-family:Arial,sans-serif;max-width:560px">'+
    '<h1>OilStation</h1><p>คุณได้รับคำเชิญให้เข้าร่วมระบบ OilStation</p>'+
    '<p><a href="'+escapeHtml(inviteUrl)+'">ยืนยันคำเชิญและเข้าสู่ระบบ</a></p>'+
    '<p>หมดอายุ: '+escapeHtml(expires)+' (เวลาไทย)</p>'+
    '<p>หากไม่ได้ร้องขอคำเชิญ กรุณาไม่เปิดลิงก์นี้</p></div>',
 };
 try{
  const r=await fetchImpl('https://api.resend.com/emails',{
   method:'POST',headers:{authorization:'Bearer '+key,
    'content-type':'application/json','idempotency-key':'oilstation-invite-'+id.toLowerCase()},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(8000),
  });
  if(!r?.ok)return {delivery:'manual',deliveryStatus:'provider_rejected'};
  const result=await r.json().catch(()=>null);
  if(typeof result?.id!=='string'||result.id.length>128)
   return {delivery:'manual',deliveryStatus:'provider_unconfirmed'};
  return {delivery:'email_accepted',deliveryStatus:'provider_accepted'};
 }catch{
  // Do not log token, addresses, provider bodies or API secrets.
  return {delivery:'manual',deliveryStatus:'provider_unconfirmed'};
 }
}
