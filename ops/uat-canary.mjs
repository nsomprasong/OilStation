// Infrastructure canary only; intentionally contains NO application, keys,
// customer records, CRUD, sign-in, Cron or Supabase connection.
const json=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-frame-options':'DENY'}});
const page=String.raw`<!doctype html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>OilStation UAT Canary</title>
<style>body{margin:0;background:#0b1823;color:#f4f6f7;font-family:system-ui,Arial,sans-serif;
display:grid;place-items:center;min-height:100vh;padding:20px;box-sizing:border-box}
main{max-width:560px;width:100%;background:#122536;border:1px solid #2e4557;
border-radius:20px;padding:28px;box-sizing:border-box}
small{color:#a5c3d0;font-weight:700;letter-spacing:.09em}h1{margin:12px 0;font-size:2rem}
p{color:#d0dce4;line-height:1.7}strong{color:#f9d08b}
code{color:#9dd9cb;overflow-wrap:anywhere}</style></head><body><main>
<small>OILSTATION · UAT INFRASTRUCTURE</small><h1>เตรียมพื้นที่ทดสอบแล้ว</h1>
<p>Cloudflare Worker สำหรับ UAT ถูกแยกจากเว็บไซต์จริงเรียบร้อย</p>
<p><strong>ยังไม่ใช่ตัวแอป OilStation</strong> และยังไม่ได้เปิดการเข้าสู่ระบบ
คูปอง การชำระเงิน หรือการเชื่อมต่อ Supabase</p>
<p>ระบบจริงจะขึ้นที่นี่เมื่อผ่านขั้นตอน Migration, Secret และ Deploy
พร้อมผลทดสอบที่ยืนยันได้</p>
<p><code>/api/health</code> ใช้ตรวจ Canary ·
<code>/api/ready</code> ยังคงปฏิเสธจนกว่าจะเปลี่ยนเป็นแอปจริง</p></main></body></html>`;
export default {
 async fetch(request){
  const u=new URL(request.url);
  if(u.pathname==='/api/health'&&request.method==='GET')
    return json(200,{service:'oilstation-uat-canary',status:'provisioned_only'});
  if(u.pathname==='/api/ready')return json(503,{ready:false,reason:'application_not_deployed'});
  if(request.method!=='GET'&&request.method!=='HEAD')
    return json(503,{error:'application_not_deployed'});
  if(u.pathname!=='/')return json(404,{error:'not_found'});
  return new Response(request.method==='HEAD'?null:page,{
   status:200,headers:{'content-type':'text/html; charset=utf-8',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY',
    'referrer-policy':'no-referrer'}});
 },
};
