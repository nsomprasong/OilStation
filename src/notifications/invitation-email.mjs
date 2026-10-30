// Optional email; provider acceptance never means delivery/identity verification.
const EMAIL=/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENDER='no-reply@oilstation.goldensoft.cloud';
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

// Do not accidentally send OilStation invitations from a sibling project.
const senderReady=env=>env?.INVITATION_FROM_EMAIL===SENDER &&
 /^re_[A-Za-z0-9_]{12,}$/.test(env?.RESEND_API_KEY??'');
const displaySender='OilStation <'+SENDER+'>';

// The isolated UAT Worker must never send an invitation or OTP to an
// arbitrary customer. An explicit exact-match test mailbox is mandatory.
// This is independent of the release database gate and defaults to deny.
const canSendToRecipient=(env,email)=>{
 if(env?.OILSTATION_DEPLOY_TARGET!=='uat') return true;
 const allowed=env?.OILSTATION_UAT_TEST_EMAIL;
 return typeof allowed==='string' && EMAIL.test(allowed) &&
   email.toLowerCase()===allowed.toLowerCase();
};

// Inline styles and a text alternative are intentional: many mail clients
// strip stylesheets, remote assets and interactive markup.
function emailShell(title,body){
 return '<!doctype html><html lang="th"><head><meta charset="UTF-8">'+
 '<meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<title>'+escapeHtml(title)+'</title></head>'+
 '<body style="margin:0;padding:24px 12px;background:#f4f7f9;color:#172331">'+
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">'+
 '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '+
 'style="max-width:560px;background:#ffffff;border:1px solid #dce6eb;border-radius:16px;overflow:hidden">'+
 '<tr><td style="background:#102b38;padding:24px 32px;font-family:Arial,sans-serif">'+
 '<div style="color:#e8f8f3;font-size:23px;font-weight:700">OilStation</div>'+
 '<div style="color:#b8d2dc;font-size:12px;margin-top:6px">ระบบบริหารสถานีบริการน้ำมัน</div>'+
 '</td></tr><tr><td style="padding:30px 32px;font-family:Arial,Tahoma,sans-serif;font-size:16px;line-height:1.75">'+
 '<h1 style="font-size:24px;line-height:1.4;color:#163140;margin:0 0 16px">'+escapeHtml(title)+'</h1>'+
 body+
 '</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #e8eef1;font-family:Arial,Tahoma,sans-serif">'+
 '<p style="font-size:12px;color:#60737e;margin:0;line-height:1.7">'+
 'อีเมลฉบับนี้ส่งจาก OilStation หากคุณไม่ได้ดำเนินการ กรุณาเพิกเฉยและอย่าแชร์ลิงก์หรือรหัสยืนยัน</p>'+
 '</td></tr></table></td></tr></table></body></html>';
}
const inviteHtml=(url,expires)=>emailShell('คำเชิญเข้าร่วม OilStation',
 '<p style="margin:0 0 18px">คุณได้รับคำเชิญให้เข้าร่วมระบบ OilStation กรุณาเปิดลิงก์ด้านล่างเพื่อยืนยันตัวตนและเริ่มใช้งานตามสิทธิ์ที่ได้รับ</p>'+
 '<p style="margin:24px 0"><a href="'+escapeHtml(url)+'" '+
 'style="display:inline-block;background:#117b70;border-radius:10px;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:700">'+
 'ยืนยันคำเชิญและเข้าสู่ระบบ</a></p>'+
 '<p style="color:#496471;font-size:14px">คำเชิญหมดอายุ: <strong>'+escapeHtml(expires)+'</strong> (เวลาไทย)</p>'+
 '<p style="font-size:13px;color:#657881">ลิงก์นี้เป็นคำเชิญเฉพาะผู้รับ อย่าส่งต่อให้บุคคลอื่น</p>');
const otpHtml=code=>emailShell('รหัสยืนยันอีเมลคำเชิญ',
 '<p style="margin:0 0 20px">ใช้รหัส 8 หลักต่อไปนี้เพื่อยืนยันว่าคุณเป็นเจ้าของอีเมลที่ได้รับคำเชิญ</p>'+
 '<div style="font-family:Consolas,monospace;font-size:32px;letter-spacing:4px;text-align:center;'+
 'background:#eaf5f2;color:#123c38;border-radius:12px;padding:18px 10px;font-weight:700">'+
 escapeHtml(code)+'</div>'+
 '<p style="margin-top:20px;font-size:14px;color:#496471">รหัสมีอายุ 10 นาที ใช้ได้กับคำเชิญที่ร้องขอเท่านั้น และใช้แทนกันระหว่างบัญชีไม่ได้</p>');

export async function sendInvitationEmail({
 env,email,inviteUrl,id,expiresAt,fetchImpl=fetch,
}){
 if(!EMAIL.test(email??'')||!UUID.test(id??'')||
    !/^https:\/\/oilstation\.goldensoft\.cloud\/invite\/[A-Za-z0-9_-]{32,128}$/.test(inviteUrl??'')||
    !Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())
  return {delivery:'manual',deliveryStatus:'invalid_invitation'};
 if(env?.INVITATION_EMAIL_ENABLED!=='true')
  return {delivery:'manual',deliveryStatus:'not_enabled'};
 if(!senderReady(env))
  return {delivery:'manual',deliveryStatus:'not_configured'};
 if(!canSendToRecipient(env,email))
  return {delivery:'manual',deliveryStatus:'recipient_not_allowed'};
 const expires=new Date(expiresAt).toLocaleString('th-TH',{
   timeZone:'Asia/Bangkok',dateStyle:'long',timeStyle:'short'
 });
 const payload={
  from:displaySender,to:[email],subject:'คำเชิญเข้าใช้งาน OilStation',
  text:'คุณได้รับคำเชิญให้เข้าร่วม OilStation\n\n'+
   'ลิงก์ยืนยันคำเชิญ: '+inviteUrl+'\nหมดอายุ: '+expires+
   ' (เวลาไทย)\nหากไม่ได้ร้องขอคำเชิญ กรุณาไม่เปิดลิงก์นี้',
  html:inviteHtml(inviteUrl,expires),
 };
 try{
  const r=await fetchImpl('https://api.resend.com/emails',{
   method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,
    'content-type':'application/json','idempotency-key':'oilstation-invite-'+id.toLowerCase()},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(8000),
  });
  if(!r?.ok)return {delivery:'manual',deliveryStatus:'provider_rejected'};
  const result=await r.json().catch(()=>null);
  if(typeof result?.id!=='string'||result.id.length>128)
   return {delivery:'manual',deliveryStatus:'provider_unconfirmed'};
  return {delivery:'email_accepted',deliveryStatus:'provider_accepted'};
 }catch{
  // Do not log tokens, recipient addresses, provider bodies or secrets.
  return {delivery:'manual',deliveryStatus:'provider_unconfirmed'};
 }
}

/** No manual disclosure of OTPs; only a verified outbound provider may send. */
export async function sendInvitedEmailOtp({env,email,code,id,fetchImpl=fetch}){
 if(env?.INVITATION_EMAIL_ENABLED!=='true'||!EMAIL.test(email??'')||
  !UUID.test(id??'')||!/^[0-9]{8}$/.test(code??'')||!senderReady(env)||
  !canSendToRecipient(env,email))
  return false;
 try{
  const response=await fetchImpl('https://api.resend.com/emails',{
   method:'POST',headers:{
    authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json',
    // This ID is a unique database challenge, not the reusable invitation ID.
    'idempotency-key':'oilstation-invite-otp-'+id.toLowerCase()
   },body:JSON.stringify({
    from:displaySender,to:[email],
    subject:'รหัสยืนยันอีเมลคำเชิญ OilStation',
    text:'รหัสยืนยันอีเมลคำเชิญ OilStation: '+code+
     '\nรหัสมีอายุ 10 นาที ใช้ได้กับบัญชีที่ร้องขอเท่านั้น'+
     '\nหากคุณไม่ได้ร้องขอ กรุณาไม่แชร์รหัสนี้',
    html:otpHtml(code),
   }),signal:AbortSignal.timeout(8000),
  });
  if(!response?.ok)return false;
  const receipt=await response.json().catch(()=>null);
  return typeof receipt?.id==='string'&&receipt.id.length<=128;
 }catch{return false;}
}
