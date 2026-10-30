/** Unified sign-in surface, same OilStation teal as the mobile workspace. */
export function authMarkup({invited=false,setup=false}={}){
 const title=setup?'ตั้งค่าผู้ดูแลครั้งแรก':invited?'ยืนยันคำเชิญ':'เข้าสู่ OilStation';
 const note=setup?'เฉพาะบัญชีผู้ดูแลที่ระบบอนุญาต':invited?'เข้าสู่ระบบด้วยบัญชีที่ได้รับเชิญ':'สำหรับสมาชิกของปั๊มและบริษัทที่ได้รับเชิญเท่านั้น';
 return `<div class="os-auth-shell">
   <section class="os-auth-hero" aria-label="OilStation">
     <div class="os-auth-wordmark"><img class="os-auth-mark" src="/oilstation-gold-logo.png?v=2" width="45" height="45" alt="" aria-hidden="true"><span>OilStation</span></div>
     <div class="os-auth-hero-copy">
       <span class="os-auth-eyebrow">OILSTATION WORKSPACE</span>
       <h1>จัดการงานปั๊ม<br>ในที่เดียว</h1>
       <p>น้ำมัน · คูปอง · บุคลากร · การเงิน</p>
     </div>
     <div class="os-auth-hero-foot">ระบบสำหรับผู้ได้รับสิทธิ์ใช้งาน</div>
   </section>
   <section class="os-auth-card" aria-label="เข้าสู่ระบบ">
     <span class="os-auth-kicker">${setup?'เริ่มต้นใช้งาน':'ยินดีต้อนรับ'}</span>
     <h2>${title}</h2>
     <p class="os-auth-description">${note}</p>
     <div class="os-auth-providers">
       <button type="button" id="google" class="os-auth-provider os-auth-google">
         <i data-brand-icon="google"></i><span>ดำเนินการด้วย Google</span></button>
       <button type="button" id="facebook" class="os-auth-provider os-auth-facebook">
         <i data-brand-icon="facebook"></i><span>ดำเนินการด้วย Facebook</span></button>
     </div>
     <p class="os-auth-note"><i data-ui-icon="shield"></i>
       ไม่มีการสมัครสาธารณะ การเข้าสู่ระบบไม่ใช่การอนุมัติสิทธิ์</p>
     ${setup||invited?'':`<div class="os-auth-actions"><a href="/setup">ตั้งค่าผู้ดูแลครั้งแรก</a></div>`}
     <p id="notice" class="notice" role="status" hidden></p>
   </section>
 </div>`;
}
