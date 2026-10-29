import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const root = document.getElementById('app');
const INVITE_KEY = 'oilstation_pending_invitation';
const BOOTSTRAP_KEY = 'oilstation_first_admin_setup';
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
function platformSetupView() {
  show(`<div class="mark" aria-hidden="true">O</div>
    <h1>เริ่มต้นผู้ดูแล OilStation</h1>
    <p class="lead">สำหรับผู้ดูแลแพลตฟอร์มคนแรกที่ได้รับอนุญาตเท่านั้น</p>
    <section class="panel"><div class="section-title">ยืนยันตัวตน</div>
    <p>ต้องใช้อีเมลที่ผู้ดูแลระบบกำหนดไว้บนเซิร์ฟเวอร์ และบัญชีอีเมลต้องผ่านการยืนยัน</p>
    <div class="auth-buttons">
    <button class="button primary" id="google">ดำเนินการด้วย Google</button>
    <button class="button secondary" id="facebook">ดำเนินการด้วย Facebook</button>
    </div><p id="notice" class="notice" hidden role="status"></p></section>`);
  document.getElementById('google').addEventListener('click',()=>login('google'));
  document.getElementById('facebook').addEventListener('click',()=>login('facebook'));
}
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

function bahtText(value) {
  if (!/^[0-9]{1,16}$/.test(String(value))) return '—';
  const number = BigInt(value);
  const integer = (number / 100n).toLocaleString('th-TH');
  return '฿' + integer + '.' + (number % 100n).toString().padStart(2, '0');
}
function bahtToSatang(text) {
  if (typeof text !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(text)) return null;
  const [integer, decimal = ''] = text.split('.');
  const amount = BigInt(integer) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (amount <= 0n || amount > 999_999_999_999_999n) return null;
  return amount.toString();
}
async function corporateWorkspace(accessToken) {
  const target = document.getElementById('corporate-workspace');
  if (!target) return;
  target.innerHTML = `
    <div class="section-title">บัญชีเติมน้ำมันของบริษัท</div>
    <p class="lead" id="corp-help">กำลังโหลดบัญชี…</p>
    <div class="account-overview" id="account-overview"></div>
    <form id="coupon-form" class="coupon-form" hidden>
      <label class="field">เลือกปั๊มน้ำมัน <select required id="account-select"></select></label>
      <label class="field">ประเภทน้ำมัน <select required id="fuel-select"></select></label>
      <label class="field">วงเงินคูปอง (บาท) <input id="amount-input" inputmode="decimal" autocomplete="off" required placeholder="เช่น 1500.00"></label>
      <label class="field">ทะเบียนรถ (ไม่บังคับ) <input id="plate-input" maxlength="40" autocomplete="off" placeholder="เช่น กข 1234"></label>
      <label class="field">อายุคูปอง <select required id="expiry-select">
        <option value="24">24 ชั่วโมง</option>
        <option value="6">6 ชั่วโมง</option>
        <option value="48">48 ชั่วโมง</option>
        <option value="72">72 ชั่วโมง</option>
      </select></label>
      <p class="hint">ระบบกันวงเงินทันทีเมื่อออกคูปองสำเร็จ หากยอดพร้อมใช้ไม่พอจะออกคูปองไม่ได้</p>
      <button id="coupon-submit" class="button primary" type="submit">ออกคูปองและกันวงเงิน</button>
      <p id="coupon-notice" class="notice" role="status" hidden></p>
    </form>
    <section class="issue-result" id="issue-result" hidden aria-live="polite">
      <h2>คูปองออกสำเร็จ</h2>
      <p>ส่งลิงก์นี้ให้ผู้ขับรถผ่าน LINE หรือ SMS ได้</p>
      <input id="share-link" readonly aria-label="ลิงก์คูปองสำหรับคนขับ">
      <button type="button" id="copy-link" class="button secondary">คัดลอกลิงก์</button>
      <div id="issued-qr" class="qr-wrapper"></div>
    </section>
  `;
  const $ = id => document.getElementById(id);
  const setNotice = (text, isError = false) => {
    $('coupon-notice').hidden = false;
    $('coupon-notice').textContent = text;
    $('coupon-notice').dataset.tone = isError ? 'error' : 'neutral';
  };
  let accounts = [];
  let pendingIdempotencyKey = null;
  let pendingPayload = null;
  const accountSelect = $('account-select');
  const fuelSelect = $('fuel-select');
  async function reloadAccounts() {
    const res = await getApi('/api/my-accounts', accessToken);
    if (!res.ok) throw new Error('อ่านบัญชีบริษัทไม่สำเร็จ');
    accounts = res.data.accounts || [];
    $('corp-help').textContent = accounts.length
      ? 'เลือกบัญชีของปั๊มที่ต้องการออกคูปอง'
      : 'ยังไม่มีบัญชีเติมน้ำมันที่ผูกกับบริษัทของคุณ';
    const prior = accountSelect.value;
    accountSelect.replaceChildren();
    const overview = $('account-overview');
    overview.replaceChildren();
    accounts.forEach(account => {
      const opt = document.createElement('option');
      opt.value = account.id;
      opt.textContent = account.stationName + ' · ' + account.companyName;
      accountSelect.appendChild(opt);
      const el = document.createElement('div');
      el.className = 'balance-card';
      const station = document.createElement('strong');
      station.textContent = account.stationName;
      const value = document.createElement('div');
      value.className = 'money';
      value.textContent = bahtText(account.availableSatang);
      const label = document.createElement('span');
      label.textContent = 'วงเงินพร้อมใช้ (หักเงินที่กันคูปองแล้ว)';
      el.append(station, value, label);
      overview.appendChild(el);
    });
    if (accounts.some(a => a.id === prior)) accountSelect.value = prior;
    $('coupon-form').hidden = !accounts.some(a => a.couponModuleEnabled);
    if (accounts.length) await reloadFuels();
  }
  async function reloadFuels() {
    fuelSelect.replaceChildren();
    const selected = accounts.find(a => a.id === accountSelect.value);
    if (!selected) return;
    if (!selected.couponModuleEnabled) {
      const opt=document.createElement('option');opt.textContent='ปั๊มนี้ยังไม่เปิดใช้โมดูลคูปอง';
      opt.value=''; fuelSelect.appendChild(opt);
      $('coupon-submit').disabled=true;
      return;
    }
    const res = await getApi('/api/my-accounts/' + encodeURIComponent(selected.id) + '/fuels', accessToken);
    if (!res.ok) { setNotice('ไม่สามารถโหลดรายการน้ำมัน',true);return; }
    (res.data.fuels || []).forEach(fuel => {
      const opt=document.createElement('option');
      opt.value=fuel.id;
      opt.textContent=fuel.name + ' · ' + fuel.corporatePrice + ' บาท/ลิตร';
      fuelSelect.appendChild(opt);
    });
    $('coupon-submit').disabled = fuelSelect.options.length===0;
  }
  accountSelect.addEventListener('change',() => { pendingIdempotencyKey=null;reloadFuels().catch(()=>setNotice('โหลดรายการน้ำมันไม่สำเร็จ',true)); });
  $('coupon-form').addEventListener('input',()=>{ pendingIdempotencyKey=null; pendingPayload=null; });
  $('coupon-form').addEventListener('submit',async event => {
    event.preventDefault();
    const amountSatang=bahtToSatang($('amount-input').value.trim());
    if (!amountSatang) return setNotice('ระบุจำนวนเงินเป็นบาท เช่น 1500 หรือ 1500.50',true);
    const accountId=accountSelect.value, stationFuelId=fuelSelect.value;
    if (!accountId || !stationFuelId) return setNotice('กรุณาเลือกปั๊มและชนิดน้ำมัน',true);
    // Preserve the exact payload and idempotency key across network retries;
    // do not regenerate expiresAt if the user did not change the form.
    if (!pendingIdempotencyKey || !pendingPayload) {
      pendingPayload=JSON.stringify({
        accountId, stationFuelId, amountSatang,
        plate:$('plate-input').value.trim(),
        expiresAt:new Date(Date.now()+Number($('expiry-select').value)*3600_000).toISOString(),
      });
      pendingIdempotencyKey=crypto.randomUUID().replace(/-/g,'');
    }
    const payload=JSON.parse(pendingPayload);
    const btn=$('coupon-submit');
    btn.disabled=true;
    setNotice('กำลังตรวจสอบและกันวงเงิน…');
    try {
      const res=await getApi('/api/coupons',accessToken,{method:'POST',
        headers:{'idempotency-key':pendingIdempotencyKey},
        body:JSON.stringify(payload)});
      if (!res.ok) return setNotice(res.data.error==='insufficient_funds'
        ? 'วงเงินพร้อมใช้ไม่เพียงพอ ไม่สามารถออกคูปองได้'
        : 'ออกคูปองไม่สำเร็จ (' + responseError(res.data) + ')',true);
      const coupon=res.data.coupon;
      pendingPayload=null;
      pendingIdempotencyKey=null;
      $('issue-result').hidden=false;
      $('share-link').value=coupon.shareUrl;
      $('issued-qr').replaceChildren();
      const canvas=document.createElement('canvas');
      $('issued-qr').appendChild(canvas);
      await QRCode.toCanvas(canvas,coupon.qrPayload,{width:240,margin:3});
      setNotice('กันวงเงินและออกคูปองเรียบร้อย');
      await reloadAccounts();
    } catch {
      setNotice('เชื่อมต่อไม่สำเร็จ ลองกดซ้ำได้โดยระบบจะตรวจรายการซ้ำให้',true);
    } finally { btn.disabled=false; }
  });
  $('copy-link').addEventListener('click',async() => {
    try { await navigator.clipboard.writeText($('share-link').value); $('copy-link').textContent='คัดลอกแล้ว'; }
    catch { $('share-link').select(); }
  });
  try { await reloadAccounts(); }
  catch { $('corp-help').textContent='โหลดบัญชีไม่ได้ กรุณาลองใหม่'; }
}


async function fuelPriceEditor(accessToken,stationId,target) {
  if (!target) return;
  target.replaceChildren();
  const title=document.createElement('h2');
  title.textContent='ตั้งราคาน้ำมันและเปิดใช้งาน';
  target.appendChild(title);
  const hint=document.createElement('p');
  hint.textContent='เลือกเฉพาะชนิดน้ำมันที่สาขาจำหน่ายจริง แล้วระบุราคาต่อลิตร';
  target.appendChild(hint);
  const res=await getApi('/api/station-fuels?stationId='+encodeURIComponent(stationId),accessToken);
  if (!res.ok) {
    const error=document.createElement('p');error.textContent='ไม่สามารถโหลดรายการน้ำมัน';target.appendChild(error);
    return;
  }
  for (const fuel of res.data.fuels||[]) {
    const row=document.createElement('div');row.className='fuel-row';
    const name=document.createElement('strong');name.textContent=fuel.name;
    const controls=document.createElement('div');controls.className='fuel-row-controls';
    const toggle=document.createElement('label');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=fuel.enabled;
    toggle.append(checkbox,document.createTextNode(' เปิดขาย'));
    const price=document.createElement('input');
    price.inputMode='decimal';price.value=fuel.publicPrice??'';
    price.placeholder='ราคา/ลิตร';price.setAttribute('aria-label','ราคาต่อลิตรสำหรับ '+fuel.name);
    const save=document.createElement('button');save.type='button';save.className='button secondary';
    save.textContent='บันทึก';
    const status=document.createElement('small');status.setAttribute('role','status');
    save.addEventListener('click',async()=>{
      if (!/^[0-9]{1,8}(?:\.[0-9]{1,4})?$/.test(price.value) || Number(price.value)<=0) {
        status.textContent='กรุณาระบุราคาที่ถูกต้อง';return;
      }
      save.disabled=true;status.textContent='กำลังบันทึก…';
      try {
        const res=await getApi('/api/station-fuel-config',accessToken,{
          method:'POST',body:JSON.stringify({
            stationId,stationFuelId:fuel.id,publicPrice:price.value,enabled:checkbox.checked,
          }),
        });
        status.textContent=res.ok?'บันทึกราคาสำเร็จ':'ไม่สำเร็จ ('+responseError(res.data)+')';
      } catch {status.textContent='เชื่อมต่อไม่สำเร็จ';}
      finally {save.disabled=false;}
    });
    controls.append(toggle,price,save);
    row.append(name,controls,status);target.appendChild(row);
  }
}

async function platformWorkspace(accessToken) {
  const target=document.getElementById('platform-workspace');
  if (!target) return;
  target.innerHTML = `
    <div class="section-title">สร้างปั๊มน้ำมัน</div>
    <p>เลือกแบรนด์และโมดูลที่ลูกค้าต้องการเปิดใช้งาน</p>
    <form class="coupon-form" id="new-station-form">
      <label class="field">ชื่อองค์กร / เจ้าของกิจการ
        <input id="org-name" autocomplete="organization" maxlength="160" required placeholder="เช่น บริษัท ตัวอย่าง จำกัด"></label>
      <label class="field">ชื่อปั๊มน้ำมัน / สาขา
        <input id="station-name" maxlength="160" required placeholder="เช่น สถานี A"></label>
      <label class="field">แบรนด์ปั๊มน้ำมัน
        <select id="brand-select" required></select></label>
      <div class="module-choices">
        <label><input type="checkbox" id="module-qr" checked> QR Coupon</label>
        <label><input type="checkbox" id="module-hr"> HR & Payroll</label>
      </div>
      <p class="hint">รายชื่อน้ำมันจะเตรียมไว้ตามแบรนด์ โดยยังปิดการขายทั้งหมดจนกว่าจะเลือกชนิดและตั้งราคา</p>
      <button class="button primary" id="new-station-submit" type="submit">สร้างปั๊ม</button>
      <p id="platform-notice" class="notice" hidden role="status"></p>
    </form>
    <div class="divider"></div>
    <div class="section-title">ปั๊มในแพลตฟอร์ม</div>
    <div id="station-list" class="module-list"><p>กำลังโหลด…</p></div>
    <div id="fuel-editor"></div>
  `;
  const el=id=>document.getElementById(id);
  const notice=(text,error=false)=>{
    el('platform-notice').hidden=false;
    el('platform-notice').textContent=text;
    el('platform-notice').dataset.tone=error?'error':'neutral';
  };
  async function loadStations(){
    const r=await getApi('/api/platform/stations',accessToken);
    if (!r.ok) throw new Error('station_list_failed');
    const list=el('station-list');
    list.replaceChildren();
    if (!r.data.stations?.length) {
      const msg=document.createElement('p');msg.textContent='ยังไม่มีปั๊มน้ำมันในระบบ';list.appendChild(msg);
    }
    for (const s of (r.data.stations||[])) {
      const node=document.createElement('div');
      node.className='module-item';
      const name=document.createElement('strong');name.textContent=s.stationName;
      const detail=document.createElement('div');detail.className='module-subtitle';
      detail.textContent=s.organizationName+' · '+s.brandName+' · '+Object.entries(s.modules||{})
        .filter(([,status])=>status==='enabled').map(([module])=>module==='qr_coupon'?'QR Coupon':'HR').join(' + ');
      const manage=document.createElement('button');
      manage.type='button';manage.className='button secondary';
      manage.textContent='จัดการน้ำมัน';
      manage.addEventListener('click',()=>fuelPriceEditor(accessToken,s.id,el('fuel-editor'))
        .catch(()=>notice('เปิดจัดการน้ำมันไม่ได้',true)));
      node.append(name,detail,manage);list.appendChild(node);
    }
  }
  try {
    const r=await getApi('/api/fuel-brands',accessToken);
    if (!r.ok) throw new Error('brands');
    (r.data.brands||[]).forEach(brand=>{
      const option=document.createElement('option');
      option.value=brand.code;
      option.textContent=brand.name_th+' ('+brand.code+')';
      el('brand-select').appendChild(option);
    });
    await loadStations();
  } catch { notice('เชื่อมต่อข้อมูลปั๊มไม่สำเร็จ',true); }
  el('new-station-form').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const data={organizationName:el('org-name').value.trim(),
      stationName:el('station-name').value.trim(),
      brandCode:el('brand-select').value,
      modules:{qrCoupon:el('module-qr').checked,hrPayroll:el('module-hr').checked}};
    if (!data.modules.qrCoupon&&!data.modules.hrPayroll) return notice('เลือกเปิดใช้งานอย่างน้อยหนึ่งโมดูล',true);
    const btn=el('new-station-submit');btn.disabled=true;notice('กำลังสร้างปั๊ม…');
    try{
      const r=await getApi('/api/platform/create-station',accessToken,
        {method:'POST',body:JSON.stringify(data)});
      if(!r.ok) return notice('ไม่สามารถสร้างปั๊มได้ ('+responseError(r.data)+')',true);
      notice('สร้างปั๊มเรียบร้อย เตรียมรายการน้ำมัน '+r.data.station.fuelProductsStaged+' รายการ (ยังไม่เปิดขาย)');
      el('new-station-form').reset();
      await loadStations();
    }catch{notice('ขัดข้องระหว่างสร้างปั๊ม กรุณาตรวจสอบรายการก่อนกดซ้ำ',true);}
    finally{btn.disabled=false;}
  });
}

function dashboard(data, session) {
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
     <div id="corporate-workspace"></div>
     <div id="platform-workspace"></div>
     <div id="station-fuel-workspace"></div>
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
  if (memberships.some(m => m.scopeType==='platform' && m.role==='platform_superadmin')) {
    platformWorkspace(session.access_token).catch(() => {});
  }
  const stationMember=memberships.find(m=>m.scopeType==='station'
    && ['station_owner','owner','manager'].includes(m.role));
  if(stationMember?.stationId) {
    fuelPriceEditor(session.access_token,stationMember.stationId,
      document.getElementById('station-fuel-workspace')).catch(()=>{});
  }
  if (memberships.some(m => m.scopeType==='corporate_company')) {
    corporateWorkspace(session.access_token).catch(() => {});
  }
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
  if (location.pathname === '/setup') sessionStorage.setItem(BOOTSTRAP_KEY,'1');
  const setup = sessionStorage.getItem(BOOTSTRAP_KEY)==='1';
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
  if (!session) return setup ? platformSetupView() : guestView(Boolean(invite));
  if (setup) {
    const bootResult = await getApi('/api/bootstrap',session.access_token,{method:'POST'});
    if (!bootResult.ok) {
      await authClient.auth.signOut();
      sessionStorage.removeItem(BOOTSTRAP_KEY);
      return showError('บัญชีนี้ไม่ได้รับอนุญาตให้เริ่มต้นผู้ดูแล หรือมีผู้ดูแลคนแรกอยู่แล้ว');
    }
    sessionStorage.removeItem(BOOTSTRAP_KEY);
    history.replaceState(null,'','/');
  }
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
  if (result.ok) return dashboard(result.data,session);
  if (result.status===403) {
    await authClient.auth.signOut();
    return guestView(false);
  }
  return showError('ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้');
}
boot().catch(() => showError('ไม่สามารถเชื่อมต่อระบบได้'));
