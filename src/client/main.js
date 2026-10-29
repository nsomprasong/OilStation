import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const root = document.getElementById('app');
const INVITE_KEY = 'oilstation_pending_invitation';
const INVITE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const COUPON_PATTERN = /^[0-9a-f-]{36}\.[a-f0-9]{64}$/i;
let authClient;

function show(html) { root.innerHTML = html; }
function message(text, tone = 'neutral') {
  const node = document.getElementById('notice');
  if (!node) return;
  node.textContent = text;
  node.dataset.tone = tone;
  node.hidden = !text;
}
function showError(msg) {
  show('<div class="mark">!</div><h1>ไม่สามารถเปิดหน้านี้ได้</h1><p class="lead" id="reason"></p><a href="/" class="button primary">กลับหน้าแรก</a>');
  document.getElementById('reason').textContent = msg;
}
function responseError(res) { return res?.error || 'ไม่สามารถดำเนินการได้'; }
function guestView(invited) {
  show(`
    <div class="mark" aria-hidden="true">O</div>
    <h1>จัดการปั๊มได้ง่ายขึ้น</h1>
    <p class="lead">คูปองน้ำมัน · พนักงาน · การเงิน</p>
    <section class="panel" aria-label="เข้าสู่ระบบ">
      <div class="section-title"><span class="status-dot"></span>
        <span>${invited ? 'ยืนยันคำเชิญเพื่อเริ่มใช้งาน' : 'พื้นที่ใช้งานสำหรับผู้ได้รับเชิญ'}</span></div>
      <p>${invited ? 'เลือกบัญชีที่คุณสะดวก' : 'เจ้าของปั๊มหรือผู้ดูแลจะส่งลิงก์เชิญทางอีเมล'}</p>
      <div class="divider"></div>
      ${invited ? `<div class="auth-buttons"><button class="button primary" id="google">เข้าสู่ระบบด้วย Google</button>
         <button class="button secondary" id="facebook">เข้าสู่ระบบด้วย Facebook</button></div>` :
        `<div class="step"><span class="number">1</span> รับอีเมลคำเชิญ</div>
         <div class="step"><span class="number">2</span> เลือก Google หรือ Facebook</div>
         <div class="step"><span class="number">3</span> เข้าสู่ระบบตามสิทธิ์</div>`}
      <div class="hint">ไม่เปิดรับสมัครสาธารณะ</div>
      <p id="notice" class="notice" role="status" hidden></p>
    </section>`);
  if (invited) {
    document.getElementById('google').addEventListener('click', () => login('google'));
    document.getElementById('facebook').addEventListener('click', () => login('facebook'));
  }
}
async function login(provider) {
  if (!authClient) return message('การเข้าสู่ระบบยังไม่ได้ตั้งค่า', 'error');
  try {
    const { error } = await authClient.auth.signInWithOAuth({
      provider, options: { redirectTo: location.origin + '/auth/callback' },
    });
    if (error) message(error.message, 'error');
  } catch { message('ไม่สามารถเชื่อมต่อผู้ให้บริการเข้าสู่ระบบ', 'error'); }
}
async function getApi(path, token, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  if (init.body) headers['content-type'] = 'application/json';
  const res = await fetch(path, { ...init, headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
function dashboard(data) {
  const memberships = data.memberships || [];
  const scopes = {
    platform: { title: 'แพลตฟอร์ม', modules: ['ปั๊มที่ให้บริการ', 'พนักงานขาย', 'การเรียกเก็บเงิน'] },
    organization: { title: 'เจ้าของกิจการ', modules: ['บริหารปั๊ม', 'สมาชิกและสิทธิ์', 'การเงิน'] },
    station: { title: 'จัดการปั๊มน้ำมัน', modules: ['คูปองเติมน้ำมัน', 'พนักงานและกะ', 'อนุมัติรายการ'] },
    corporate_company: { title: 'บัญชีลูกค้าบริษัท', modules: ['คูปองเติมน้ำมัน', 'วงเงินและยอดใช้', 'ประวัติเติมน้ำมัน'] },
  };
  const active = scopes[memberships[0]?.scopeType] || scopes.station;
  show(`<div class="mark" aria-hidden="true">O</div>
   <div class="eyebrow">OilStation Workspace</div><h1 id="scope-title"></h1>
   <p class="lead">เข้าสู่ระบบสำเร็จ</p>
   <section class="panel"><div class="section-title"><span class="status-dot"></span>สิทธิ์ของคุณ</div>
     <div class="scope-list" id="scopes"></div><div class="divider"></div>
     <div class="module-list" id="modules"></div>
     <p class="hint">เมนูธุรกรรมจะเปิดตามสิทธิ์และโมดูลที่ปั๊มสมัครใช้งาน</p>
     <button class="button secondary" id="logout">ออกจากระบบ</button>
   </section>`);
  document.getElementById('scope-title').textContent = active.title;
  const all = document.getElementById('scopes');
  memberships.forEach((m) => {
    const e = document.createElement('div');
    e.className = 'scope-chip';
    e.textContent = m.role + ' · ' + (scopes[m.scopeType]?.title || m.scopeType);
    all.appendChild(e);
  });
  const modules = document.getElementById('modules');
  active.modules.forEach((name) => {
    const e = document.createElement('div');
    e.className = 'module-item';
    e.textContent = name;
    modules.appendChild(e);
  });
  document.getElementById('logout').addEventListener('click', async () => {
    await authClient.auth.signOut();
    location.replace('/');
  });
}
async function couponViewer(token) {
  if (!COUPON_PATTERN.test(token)) return showError('ลิงก์คูปองไม่ถูกต้อง');
  show('<div class="mark" aria-hidden="true">O</div><h1>คูปองเติมน้ำมัน</h1><p class="lead">กำลังตรวจสอบคูปอง…</p>');
  async function refresh() {
    const result = await getApi('/api/coupon-view?token=' + encodeURIComponent(token), null);
    if (!result.ok) return showError('คูปองไม่ถูกต้องหรือถูกเพิกถอน');
    const c = result.data;
    show(`<div class="mark" aria-hidden="true">O</div><h1>คูปองเติมน้ำมัน</h1>
      <p class="lead">แสดง QR ให้พนักงานสแกนที่ปั๊ม</p>
      <section class="panel coupon-card">
        <div class="section-title"><span class="status-dot"></span><span id="station"></span></div>
        <p id="fuel"></p>
        <div class="qr-wrapper" id="qr-box"></div>
        <div class="money" id="limit"></div>
        <p id="expiry"></p><div class="hint" id="coupon-state"></div>
      </section>`);
    document.getElementById('station').textContent = c.stationName || 'ปั๊มน้ำมัน';
    document.getElementById('fuel').textContent = c.fuelName || 'น้ำมัน';
    document.getElementById('limit').textContent = 'สูงสุด ฿' + (Number(c.amountSatang) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    document.getElementById('expiry').textContent = 'หมดอายุ: ' + new Date(c.expiresAt).toLocaleString('th-TH');
    document.getElementById('coupon-state').textContent = c.replaced ? 'แสดงคูปองใบใหม่แล้ว' : {
      reserved:'พร้อมใช้',verified:'ตรวจสอบแล้ว',fueling:'กำลังเติมน้ำมัน',
      completed:'เติมน้ำมันแล้ว',cancelled:'ถูกยกเลิก',expired:'หมดอายุ',
    }[c.status] || 'ไม่สามารถใช้งานได้';
    if (c.qrPayload) {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', 'QR คูปองเติมน้ำมัน');
      document.getElementById('qr-box').appendChild(canvas);
      await QRCode.toCanvas(canvas,c.qrPayload,{width:260,margin:3,errorCorrectionLevel:'M'});
    }
  }
  await refresh();
  // Automatic refresh while open; no protected company balance is sent.
  setInterval(() => { if (!document.hidden) refresh().catch(() => {}); },15_000);
}
async function boot() {
  if (location.pathname.startsWith('/c/')) return couponViewer(decodeURIComponent(location.pathname.slice(3)));
  const pathInvite = location.pathname.startsWith('/invite/') ?
    decodeURIComponent(location.pathname.slice('/invite/'.length)) : null;
  if (pathInvite) {
    if (!INVITE_PATTERN.test(pathInvite)) return showError('รูปแบบลิงก์เชิญไม่ถูกต้อง');
    sessionStorage.setItem(INVITE_KEY,pathInvite);
  }
  const invite = sessionStorage.getItem(INVITE_KEY);
  let cfg;
  try {
    const res = await getApi('/api/public-config',null);
    if (!res.ok) throw new Error('service_not_configured');
    cfg = res.data;
    authClient = createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
      auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true},
    });
  } catch { return guestView(false); }
  const { data: {session}, error } = await authClient.auth.getSession();
  if (error) return showError('เข้าสู่ระบบไม่สำเร็จ');
  if (!session) return guestView(Boolean(invite));
  if (invite) {
    const accepted = await getApi('/api/invitations/accept',session.access_token,{
      method:'POST',body:JSON.stringify({token:invite}),
    });
    if (!accepted.ok) {
      guestView(true);
      return message(accepted.data.error === 'invited_email_verification_required' ?
        'อีเมลบัญชีนี้ไม่ตรงกับคำเชิญ กรุณายืนยันอีเมลที่ได้รับคำเชิญ' :
        responseError(accepted.data),'error');
    }
    sessionStorage.removeItem(INVITE_KEY);
    history.replaceState(null,'','/');
  }
  const result = await getApi('/api/me',session.access_token);
  if (result.ok) return dashboard(result.data);
  if (result.status===403) {
    await authClient.auth.signOut();
    return guestView(false);
  }
  return showError('ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้');
}
boot().catch(() => showError('ไม่สามารถเชื่อมต่อระบบได้'));
