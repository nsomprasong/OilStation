/** Human-facing recovery messages for public API error codes.
 * Never show raw server diagnostics or interpret payment status client-side.
 */
const ERRORS=Object.freeze({
  unauthenticated:"เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  permission_denied:"บัญชีนี้ไม่มีสิทธิ์ทำรายการ กรุณาตรวจบทบาทกับผู้ดูแล",
  forbidden:"บัญชีนี้ไม่มีสิทธิ์ทำรายการ กรุณาตรวจบทบาทกับผู้ดูแล",
  rate_limited:"มีการทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
  invalid_request:"ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจช่องที่จำเป็น",
  invalid_json:"ข้อมูลที่ส่งไม่สมบูรณ์ กรุณาลองใหม่",
  release_not_enabled:"ฟังก์ชันนี้ยังไม่เปิดให้บริการ กรุณาติดต่อผู้ดูแล",
  service_not_configured:"ระบบยังตั้งค่าบริการไม่ครบ กรุณาติดต่อผู้ดูแล",
  plan_in_use:"แพ็กเกจนี้มีลูกค้าใช้งานหรือรอชำระอยู่ จึงลบไม่ได้",
  billing_configuration_unavailable:"บันทึกราคาไม่ได้ ตรวจรหัสแพ็กเกจ ราคาและวันที่เริ่มใช้",
  provider_unavailable:"ผู้ให้บริการอีเมลไม่พร้อม กรุณาคัดลอกลิงก์เพื่อส่งเอง",
  service_unavailable:"เชื่อมต่อบริการไม่ได้ กรุณาลองใหม่",
  internal_error:"ระบบขัดข้อง กรุณาลองใหม่หรือติดต่อผู้ดูแล",
  not_found:"ไม่พบรายการนี้ กรุณารีเฟรชหน้าแล้วลองใหม่",
});
export function humanizeApiError(code,fallback="ทำรายการไม่สำเร็จ กรุณาลองใหม่"){
 if(typeof code!=="string")return fallback;
 return ERRORS[code]||fallback;
}
export function setUiStatus(element,text,tone="neutral"){
 if(!element)return;
 element.textContent=text;
 element.dataset.tone=tone;
 element.hidden=!text;
}
