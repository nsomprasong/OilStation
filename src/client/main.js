import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { makeIcon, decorateIcons } from './icons.js';
import { mountAttendanceWorkspace } from './attendance.js';
import { mountPlatformSaasBilling } from './platform-saas-billing.js';
import {mountStationPlanChoice} from './station-plan-choice.js';
import { mountBillingWorkspace } from './billing.js';
import { mountAttendancePayrollPreview } from './attendance-payroll-preview.js';
import { mountAttendanceReview } from './attendance-review.js';
import { mountPlateReviewInbox } from './plate-review.js';
import { mountFuelReviewInbox } from './fuel-review.js';
import {selectWorkspaceScreens,renderWorkspaceShell,wireWorkspaceNavigation} from './workspace-layout.js';
import {humanizeApiError,setUiStatus} from './ui-status.js';

const root = document.getElementById('app');
const INVITE_KEY = 'oilstation_pending_invitation';
const BOOTSTRAP_KEY = 'oilstation_first_admin_setup';
const INVITE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const COUPON_PATTERN = /^[0-9a-f-]{36}\.[a-f0-9]{64}$/i;
let authClient;

function show(html) { root.classList.remove('workspace-mode');root.innerHTML = html; decorateIcons(root); }
// Dynamic forms are inserted after async data loads; decorate their placeholders too.
const iconObserver = new MutationObserver(() => decorateIcons(root));
iconObserver.observe(root, {subtree:true,childList:true});
function message(text, tone = 'neutral') {
  const node = document.getElementById('notice');
  if (!node) return;
  setUiStatus(node,text,tone);
}
function showError(msg) {
  show('<div class="mark">!</div><h1>ไม่สามารถเปิดหน้านี้ได้</h1><p class="lead" id="reason"></p><a href="/" class="button primary">กลับหน้าแรก</a>');
  document.getElementById('reason').textContent = msg;
}
function responseError(res) { return humanizeApiError(res?.error); }
function platformSetupView() {
  show(`<div class="mark" aria-hidden="true">O</div>
    <h1>เริ่มต้นผู้ดูแล OilStation</h1>
    <p class="lead">สำหรับผู้ดูแลแพลตฟอร์มคนแรกที่ได้รับอนุญาตเท่านั้น</p>
    <section class="panel"><div class="section-title">ยืนยันตัวตน</div>
    <p>ต้องใช้อีเมลที่ผู้ดูแลระบบกำหนดไว้บนเซิร์ฟเวอร์ และบัญชีอีเมลต้องผ่านการยืนยัน</p>
    <div class="auth-buttons">
    <button class="button primary" id="google"><i data-brand-icon="google"></i>ดำเนินการด้วย Google</button>
    <button class="button secondary" id="facebook"><i data-brand-icon="facebook"></i>ดำเนินการด้วย Facebook</button>
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
        <span>${invited ? 'ยืนยันคำเชิญเพื่อเริ่มใช้งาน' : 'เข้าสู่ระบบ OilStation'}</span></div>
      <p>${invited ? 'เข้าสู่ระบบเพื่อยืนยันคำเชิญของคุณ' : 'สำหรับผู้ดูแลและผู้ที่ได้รับเชิญจากองค์กรเท่านั้น'}</p>
      <div class="divider"></div>
      <div class="auth-buttons">
        <button class="button primary" id="google"><i data-brand-icon="google"></i>เข้าสู่ระบบด้วย Google</button>
        <button class="button secondary" id="facebook"><i data-brand-icon="facebook"></i>เข้าสู่ระบบด้วย Facebook</button>
      </div>
      ${invited ? '' : `<div class="step"><span class="number">1</span><i data-ui-icon="mail"></i> สมาชิกใหม่รับลิงก์เชิญจากผู้ดูแล</div>
         <div class="step"><span class="number">2</span><i data-ui-icon="shield"></i> เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต</div>`}
      <p class="hint">ไม่เปิดรับสมัครสาธารณะ การเข้าสู่ระบบไม่ได้ให้สิทธิ์ใช้งานโดยอัตโนมัติ</p>
      ${invited ? '' : '<a class="button secondary" href="/setup">ตั้งค่าผู้ดูแลระบบคนแรก</a>'}
      <p id="notice" class="notice" role="status" hidden></p>
    </section>`);
  document.getElementById('google').addEventListener('click', () => login('google'));
  document.getElementById('facebook').addEventListener('click', () => login('facebook'));
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
    <div id="company-link-inbox" class="module-list"></div>
    <div id="company-bank-options" class="module-list" aria-live="polite"></div>
    <form id="topup-upload-form" class="coupon-form" hidden>
      <h3>แจ้งเติมเงินผ่านการโอน</h3>
      <label class="field">บัญชีธนาคารของปั๊ม <select id="topup-bank" required></select></label>
      <label class="field">จำนวนเงินที่โอน (บาท) <input id="topup-amount" inputmode="decimal" placeholder="เช่น 1200.00" required></label>
      <label class="field">ภาพสลิปโอนเงิน (JPEG/PNG สูงสุด 5 MB)
        <input id="topup-slip" type="file" accept="image/jpeg,image/png" required>
      </label>
      <button class="button primary" id="topup-upload-btn" type="submit">
        <i data-ui-icon="receipt"></i>ส่งสลิปให้ปั๊มตรวจสอบ
      </button>
      <p id="topup-notice" class="notice" hidden role="status"></p>
      <p class="hint">การส่งสลิปไม่ใช่การเติมเงินสำเร็จ ยอดพร้อมใช้จะเพิ่มหลังจากปั๊มตรวจเงินเข้าจริงและอนุมัติเท่านั้น</p>
    </form>
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
      <button id="coupon-submit" class="button primary" type="submit"><i data-ui-icon="ticket"></i>ออกคูปองและกันวงเงิน</button>
      <p id="coupon-notice" class="notice" role="status" hidden></p>
    </form>
    <section class="issue-result" id="issue-result" hidden aria-live="polite">
      <h2>คูปองออกสำเร็จ</h2>
      <p>ส่งลิงก์นี้ให้ผู้ขับรถผ่าน LINE หรือ SMS ได้</p>
      <input id="share-link" readonly aria-label="ลิงก์คูปองสำหรับคนขับ">
      <button type="button" id="copy-link" class="button secondary"><i data-ui-icon="clipboard"></i>คัดลอกลิงก์</button>
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
       const check=document.createElement('button');
       check.type='button';check.className='button secondary wallet-check-button';
       check.textContent='ตรวจยอดจองคูปองและลูกหนี้';
       const report=document.createElement('p');
       report.className='hint';report.setAttribute('role','status');
       check.addEventListener('click',async()=>{
         check.disabled=true;report.textContent='กำลังตรวจยอดบัญชีที่เกี่ยวข้อง…';
         try{
           const res=await getApi('/api/corporate/wallet-integrity?accountId='+
             encodeURIComponent(account.id),accessToken);
           const x=res.data?.integrity;
           if(!res.ok||x?.readOnly!==true||x?.bankReconciled!==false)
             throw new Error('not_allowed_or_unavailable');
           report.textContent=x.healthy===true?
             'ยอดจองคูปองและยอดลูกหนี้ตรงกับยอดบัญชี (ยังไม่ใช่การกระทบยอดธนาคาร)':
             'พบยอดจองคูปองหรือยอดลูกหนี้ไม่ตรงกัน โปรดติดต่อผู้ดูแลเพื่อตรวจสอบก่อนใช้งาน';
           report.dataset.tone=x.healthy===true?'neutral':'error';
         }catch{
           report.textContent='ตรวจยอดไม่ได้ กรุณาตรวจสิทธิ์การเงินหรือการเชื่อมต่อ';
           report.dataset.tone='error';
         }finally{check.disabled=false;}
       });
       el.append(check,report);
      overview.appendChild(el);
    });
    if (accounts.some(a => a.id === prior)) accountSelect.value = prior;
    $('coupon-form').hidden = !accounts.some(a => a.couponModuleEnabled);
    if (accounts.length) { await reloadFuels(); await reloadBankOptions(); }
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
  async function reloadBankOptions() {
    const view=$('company-bank-options');
    view.replaceChildren();
    const topupForm=$('topup-upload-form');
    const bankSelect=$('topup-bank');
    topupForm.hidden=true;bankSelect.replaceChildren();
    const id=accountSelect.value;
    if(!id)return;
    const res=await getApi('/api/topup/banks?accountId='+encodeURIComponent(id),accessToken);
    if(!res.ok)return;
    const heading=document.createElement('div');heading.className='section-title';
    heading.append(makeIcon('wallet'),document.createTextNode('บัญชีรับเงินของปั๊ม'));
    view.appendChild(heading);
    if(!res.data.banks?.length){
      const message=document.createElement('p');
      message.textContent='ปั๊มนี้ยังไม่ได้ตั้งค่าบัญชีธนาคารสำหรับรับเงิน';
      view.appendChild(message);return;
    }
    for(const bank of res.data.banks){
      const item=document.createElement('div');
      item.className='module-item';
      const line=document.createElement('strong');
      line.textContent=bank.bankCode+' · '+bank.accountName;
      const detail=document.createElement('p');detail.className='module-subtitle';
      detail.textContent='บัญชี '+(bank.accountNumberMasked||'โปรดติดต่อปั๊มเพื่อขอเลขบัญชี');
      item.append(line,detail);view.appendChild(item);
      const opt=document.createElement('option');opt.value=bank.id;
      opt.textContent=bank.bankCode+' · '+bank.accountName+' · '+(bank.accountNumberMasked||'');
      bankSelect.appendChild(opt);
    }
    const note=document.createElement('p');
    note.className='hint';
    note.textContent='ส่งสลิปได้หลังโอนเงินจริง ยอดเงินจะยังไม่เปลี่ยนจนกว่าปั๊มจะตรวจสอบรายการจากธนาคาร';
    view.appendChild(note);
    topupForm.hidden=false;
  }
  $('topup-upload-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const accountId=accountSelect.value,bankId=$('topup-bank').value;
    const satang=bahtToSatang($('topup-amount').value.trim());
    const file=$('topup-slip').files?.[0];
    const notice=$('topup-notice'),button=$('topup-upload-btn');
    const status=(text,error=false)=>{
      notice.textContent=text;notice.dataset.tone=error?'error':'neutral';notice.hidden=false;
    };
    if(!accountId||!bankId||!satang||BigInt(satang)<100n||BigInt(satang)>100000000000n)
      return status('กรุณาตรวจสอบบัญชีและจำนวนเงินที่โอน',true);
    if(!file||!['image/jpeg','image/png'].includes(file.type)||file.size<64||file.size>5*1024*1024)
      return status('กรุณาแนบภาพ JPEG/PNG ขนาดไม่เกิน 5 MB',true);
    button.disabled=true;accountSelect.disabled=true;
    status('กำลังรับสลิปแบบส่วนตัว…');
    try{
      const uri='/api/evidence/topup?accountId='+encodeURIComponent(accountId)
        +'&bankId='+encodeURIComponent(bankId)+'&amountSatang='+encodeURIComponent(satang);
      const res=await fetch(uri,{method:'POST',headers:{
        authorization:'Bearer '+accessToken,'content-type':file.type,
      },body:file,cache:'no-store'});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)return status('ส่งสลิปไม่สำเร็จ ('+(data.error||'service_unavailable')+')',true);
      status('ส่งสลิปสำเร็จ รายการอยู่ระหว่างรอปั๊มตรวจเงินเข้าธนาคาร (ยังไม่เพิ่มวงเงิน)');
      $('topup-upload-form').reset();
    }catch{status('ไม่สามารถยืนยันการรับสลิปได้ โปรดตรวจสอบกับปั๊มก่อนส่งซ้ำ',true);}
    finally{button.disabled=false;accountSelect.disabled=false;}
  });
  accountSelect.addEventListener('change',() => {
    pendingIdempotencyKey=null;
    reloadFuels().catch(()=>setNotice('โหลดรายการน้ำมันไม่สำเร็จ',true));
    reloadBankOptions().catch(()=>setNotice('โหลดบัญชีธนาคารไม่ได้',true));
  });
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
  async function reloadLinkRequests(){
    const inbox=$('company-link-inbox');inbox.replaceChildren();
    const r=await getApi('/api/corporate/pending-links',accessToken);
    if (!r.ok||!r.data.requests?.length) return;
    const title=document.createElement('h3');
    title.textContent='คำขอเชื่อมปั๊มใหม่';inbox.appendChild(title);
    for (const request of r.data.requests){
      const item=document.createElement('div');item.className='module-item';
      const heading=document.createElement('strong');heading.textContent=request.stationName;
      const details=document.createElement('p');
      details.textContent='ขอเชื่อมกับบริษัท '+request.companyName;
      const approve=document.createElement('button');approve.type='button';
      approve.className='button primary';approve.textContent='อนุมัติ';
      const reject=document.createElement('button');reject.type='button';
      reject.className='button secondary';reject.textContent='ปฏิเสธ';
      const status=document.createElement('small');status.setAttribute('role','status');
      async function review(approved){
        approve.disabled=true;reject.disabled=true;status.textContent='กำลังบันทึก…';
        const result=await getApi('/api/corporate/approve-link',accessToken,{
          method:'POST',body:JSON.stringify({requestId:request.requestId,approved}),
        }).catch(()=>null);
        if(!result?.ok){
          status.textContent='บันทึกไม่สำเร็จ';
          approve.disabled=false;reject.disabled=false;return;
        }
        await reloadLinkRequests();
        await reloadAccounts();
      }
      approve.addEventListener('click',()=>review(true));
      reject.addEventListener('click',()=>review(false));
      item.append(heading,details,approve,reject,status);
      inbox.appendChild(item);
    }
  }
  try { await reloadAccounts(); await reloadLinkRequests(); }
  catch { $('corp-help').textContent='โหลดบัญชีไม่ได้ กรุณาลองใหม่'; }
}


function createInviteControl(accessToken,scopeType,scopeId,roleChoices) {
  const wrapper=document.createElement('div');
  wrapper.className='invite-control';
  const toggle=document.createElement('button');
  toggle.className='button secondary';toggle.type='button';toggle.textContent='เชิญสมาชิก';
  const box=document.createElement('form');
  box.className='invite-form';box.hidden=true;
  const email=document.createElement('input');
  email.type='email';email.required=true;email.placeholder='อีเมลผู้รับคำเชิญ';
  email.setAttribute('aria-label','อีเมลผู้รับคำเชิญ');
  const roles=document.createElement('select');
  roles.setAttribute('aria-label','สิทธิ์ที่จะเชิญ');
  for(const [code,label] of roleChoices){
    const opt=document.createElement('option');opt.value=code;opt.textContent=label;roles.appendChild(opt);
  }
  const submit=document.createElement('button');
  submit.type='submit';submit.className='button primary';submit.textContent='สร้างคำเชิญ';
  const status=document.createElement('small');status.setAttribute('role','status');
  const link=document.createElement('input');link.readOnly=true;link.hidden=true;
  link.setAttribute('aria-label','ลิงก์คำเชิญ');
  const copy=document.createElement('button');
  copy.className='button secondary';copy.type='button';copy.textContent='คัดลอกลิงก์';copy.hidden=true;
  toggle.setAttribute('aria-expanded','false');
  email.autocomplete='email';
  toggle.addEventListener('click',()=>{
    box.hidden=!box.hidden;
    toggle.setAttribute('aria-expanded',String(!box.hidden));
    if(!box.hidden)email.focus();
  });
  copy.addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(link.value);copy.textContent='คัดลอกแล้ว';}
    catch {link.select();}
  });
  box.addEventListener('submit',async(event)=>{
    event.preventDefault();submit.disabled=true;status.textContent='กำลังสร้างคำเชิญ…';
    try{
      const r=await getApi('/api/invitations/create',accessToken,{
        method:'POST',body:JSON.stringify({
          email:email.value.trim(),roleCode:roles.value,scopeType,scopeId,
        }),
      });
      if(!r.ok){setUiStatus(status,'สร้างคำเชิญไม่สำเร็จ: '+responseError(r.data),'error');return;}
      link.value=r.data.invitation.inviteUrl;link.hidden=false;copy.hidden=false;
      const accepted=r.data.invitation.delivery==='email_accepted';
      setUiStatus(status,accepted?
        'ผู้ให้บริการรับคำขอส่งอีเมลแล้ว (ยังไม่ยืนยันการส่งถึงผู้รับ) สามารถคัดลอกลิงก์ได้':
        'สร้างลิงก์แล้ว การส่งอีเมลอัตโนมัติยังไม่ยืนยัน กรุณาคัดลอกและส่งให้ผู้รับ',
        accepted?'success':'warning');
    }catch{setUiStatus(status,'เชื่อมต่อไม่ได้ กรุณาตรวจสอบรายการก่อนลองซ้ำ','error');}
    finally{submit.disabled=false;}
  });
  box.append(email,roles,submit,status,link,copy);
  wrapper.append(toggle,box);
  return wrapper;
}

async function hrWorkspace(token,stationId,target) {
 if(!target)return;
 target.innerHTML = `
  <div class="divider"></div><h2>พนักงานและตารางกะ</h2>
  <p>สร้างพนักงาน และกำหนดกะเช้า กะบ่าย กะดึก รวมถึงควบกะได้</p>
  <button class="button secondary" type="button" id="hr-seed">เตรียมกะมาตรฐาน</button>
  <form class="coupon-form" id="hr-add-employee">
    <label class="field">รหัสพนักงาน <input id="hr-employee-code" required maxlength="40"></label>
    <label class="field">ชื่อพนักงาน <input id="hr-employee-name" required maxlength="200"></label>
    <label class="field">ประเภทค่าจ้าง <select id="hr-wage-type"><option value="monthly">รายเดือน</option><option value="daily">รายวัน</option><option value="hourly">รายชั่วโมง</option></select></label>
    <label class="field">ค่าจ้าง (บาท) <input id="hr-wage" required inputmode="decimal" placeholder="15000.00"></label>
    <label class="field">รอบจ่ายเงิน <select id="hr-frequency"><option value="monthly">รายเดือน</option><option value="semi_monthly">เดือนละ 2 ครั้ง</option><option value="weekly">รายสัปดาห์</option></select></label>
    <button type="submit" class="button primary"><i data-ui-icon="user-plus"></i>เพิ่มพนักงาน</button>
  </form>
  <div class="divider"></div>
  <form class="coupon-form" id="hr-schedule">
    <label class="field">พนักงาน <select id="hr-select-employee" required></select></label>
    <label class="field">กะ <select id="hr-select-template" required></select></label>
    <label class="field">วันที่ทำงาน <input id="hr-shift-date" type="date" required></label>
    <button type="submit" class="button primary"><i data-ui-icon="calendar"></i>จัดกะให้พนักงาน</button>
  </form>
  <p class="hint">การจัดสองกะในวันเดียวกันทำได้ โดยเลือกพนักงานคนเดิมแล้วเพิ่มอีกกะ</p>
  <div class="divider"></div>
  <h3>ทำงานแทนกะ (ขออนุมัติย้อนหลัง)</h3>
  <form class="coupon-form" id="hr-replacement">
    <label class="field">กะที่ต้องการเปลี่ยน <select id="hr-original-assignment" required></select></label>
    <label class="field">กะที่ไปทำแทน <select id="hr-replacement-template" required></select></label>
    <label class="field">เหตุผล <input id="hr-replacement-reason" required maxlength="500" placeholder="เช่น ช่วยแทนกะบ่าย"></label>
    <button class="button secondary" type="submit">บันทึกกะทำงานแทน</button>
  </form>
  <div class="divider"></div>
  <h3>ขอ OT ล่วงหน้า / ย้อนหลัง</h3>
  <form class="coupon-form" id="hr-ot-request">
    <label class="field">กะที่ขอ OT <select id="hr-ot-shift" required></select></label>
    <label class="field">ประเภท <select id="hr-ot-planned">
      <option value="planned">ขอล่วงหน้า</option>
      <option value="retro">ขอย้อนหลัง</option>
    </select></label>
    <label class="field">นาทีที่ขอ (สูงสุด 960 นาที) <input id="hr-ot-minutes" type="number" min="1" max="960" required></label>
    <label class="field">เหตุผล <input id="hr-ot-reason" maxlength="500" minlength="4" required></label>
    <button class="button secondary" type="submit"><i data-ui-icon="clipboard"></i>ส่งคำขอ OT</button>
  </form>
  <h3>OT รอตรวจสอบ</h3><div id="hr-ot-pending" class="module-list"></div>
  <div class="divider"></div><h3>รายการเปลี่ยนกะรออนุมัติ</h3>
  <div id="hr-pending-approvals" class="module-list"></div>
  <p id="hr-notice" class="notice" role="status" hidden></p>
  <div id="hr-assignment-list" class="module-list"></div>
 `;
 const $=id=>document.getElementById(id);
 const note=(value,err=false)=>{const n=$('hr-notice');n.textContent=value;n.hidden=false;n.dataset.tone=err?'error':'neutral';};
 let roster={employees:[],shiftTemplates:[],assignments:[]};
 async function refresh(){
   const r=await getApi('/api/hr/roster?stationId='+encodeURIComponent(stationId),token);
   if(!r.ok)return note('ไม่สามารถโหลดตารางกะได้',true);
   roster=r.data.roster;
   const e=$('hr-select-employee'),t=$('hr-select-template');
   const selected=e.value,selShift=t.value;
   e.replaceChildren();t.replaceChildren();
   roster.employees.forEach(x=>{
     const opt=document.createElement('option');opt.value=x.id;opt.textContent=x.name+' ('+x.code+')';e.appendChild(opt);
   });
   roster.shiftTemplates.forEach(x=>{
     const opt=document.createElement('option');opt.value=x.id;opt.textContent=x.name+' ('+x.startsAt.slice(0,5)+'–'+x.endsAt.slice(0,5)+')';
     t.appendChild(opt);
   });
   if(roster.employees.some(x=>x.id===selected))e.value=selected;
   if(roster.shiftTemplates.some(x=>x.id===selShift))t.value=selShift;
   const original=$('hr-original-assignment');
   const replacement=$('hr-replacement-template');
   original.replaceChildren();replacement.replaceChildren();
   for (const x of roster.shiftTemplates){
     const opt=document.createElement('option');opt.value=x.id;opt.textContent=x.name;
     replacement.appendChild(opt);
   }
   for (const a of roster.assignments){
     if(!['scheduled','absence_review'].includes(a.status))continue;
     const emp=roster.employees.find(x=>x.id===a.employeeId);
     const shift=roster.shiftTemplates.find(x=>x.id===a.templateId);
     const opt=document.createElement('option');
     opt.value=a.id;opt.textContent=a.date+' · '+(emp?.name||'พนักงาน')+' · '+(shift?.name||'กะ');
     original.appendChild(opt);
   }
   const otShift=$('hr-ot-shift');otShift.replaceChildren();
   for(const a of roster.assignments){
     const opt=document.createElement('option');
     opt.value=a.id;
     const emp=roster.employees.find(x=>x.id===a.employeeId);
     opt.textContent=a.date+' · '+(emp?.name||'พนักงาน')+' · '+(roster.shiftTemplates.find(x=>x.id===a.templateId)?.name||'กะ');
     opt.dataset.employeeId=a.employeeId;
     otShift.appendChild(opt);
   }
   const list=$('hr-assignment-list');list.replaceChildren();
   for(const a of roster.assignments){
     const emp=roster.employees.find(x=>x.id===a.employeeId);
     const shift=roster.shiftTemplates.find(x=>x.id===a.templateId);
     const node=document.createElement('div');node.className='module-item';
     node.textContent=a.date+' · '+(emp?.name??'พนักงาน')+' · '+(shift?.name??'กะ')+' · '+a.status;
     list.appendChild(node);
   }
   const ot=await getApi('/api/hr/pending-ot?stationId='+encodeURIComponent(stationId),token);
   const otList=$('hr-ot-pending');otList.replaceChildren();
   if(ot.ok){
     for(const item of ot.data.requests||[]){
       const row=document.createElement('div');row.className='module-item';
       const name=document.createElement('strong');
       name.textContent=item.employeeName+' · '+item.shiftDate;
       const details=document.createElement('p');
       details.textContent=(item.planned?'ล่วงหน้า':'ย้อนหลัง')+' '+item.requestedMinutes+' นาที · '+item.reason;
       const minutes=document.createElement('input');
       minutes.type='number';minutes.min='0';minutes.max=String(item.requestedMinutes);
       minutes.value=String(item.requestedMinutes);
       minutes.setAttribute('aria-label','นาที OT ที่อนุมัติ');
       const approve=document.createElement('button');approve.type='button';
       approve.className='button primary';approve.textContent='อนุมัติ';
       const reject=document.createElement('button');reject.type='button';
       reject.className='button secondary';reject.textContent='ปฏิเสธ';
       const status=document.createElement('small');status.setAttribute('role','status');
       async function review(value){
         approve.disabled=true;reject.disabled=true;
         const res=await getApi('/api/hr/review-ot',token,{method:'POST',body:JSON.stringify({
           requestId:item.id,approvedMinutes:value,
         })}).catch(()=>null);
         if(!res?.ok){status.textContent='อนุมัติไม่สำเร็จ';approve.disabled=false;reject.disabled=false;return;}
         await refresh();
       }
       approve.addEventListener('click',()=>{
         const value=Number(minutes.value);
         if(!Number.isInteger(value)||value<0||value>item.requestedMinutes){
           status.textContent='จำนวนนาทีไม่ถูกต้อง';return;
         }
         review(value);
       });
       reject.addEventListener('click',()=>review(0));
       row.append(name,details,minutes,approve,reject,status);otList.appendChild(row);
     }
   }
   const pending=await getApi('/api/hr/pending-substitutes?stationId='+encodeURIComponent(stationId),token);
   const pendingList=$('hr-pending-approvals');pendingList.replaceChildren();
   if(pending.ok){
     for(const r of pending.data.requests||[]){
       const box=document.createElement('div');box.className='module-item';
       const title=document.createElement('strong');title.textContent=r.employeeName+' · '+r.date;
       const description=document.createElement('div');
       description.textContent=r.originalShift+' → '+r.replacementShift+' · '+r.reason;
       const approve=document.createElement('button');approve.className='button primary';approve.type='button';approve.textContent='อนุมัติ';
       const reject=document.createElement('button');reject.className='button secondary';reject.type='button';reject.textContent='ปฏิเสธ';
       const notice=document.createElement('small');notice.setAttribute('role','status');
       async function review(approved){
         approve.disabled=true;reject.disabled=true;
         const result=await getApi('/api/hr/review-substitute',token,{
           method:'POST',body:JSON.stringify({requestId:r.requestId,approved}),
         }).catch(()=>null);
         if(!result?.ok){notice.textContent='อนุมัติไม่ได้ โปรดให้ผู้จัดการอีกคนตรวจสอบ';approve.disabled=false;reject.disabled=false;return;}
         await refresh();
       }
       approve.addEventListener('click',()=>review(true));
       reject.addEventListener('click',()=>review(false));
       box.append(title,description,approve,reject,notice);pendingList.appendChild(box);
     }
   }
 }
 $('hr-ot-request').addEventListener('submit',async e=>{
   e.preventDefault();
   const select=$('hr-ot-shift');const option=select.selectedOptions[0];
   if(!option)return note('กรุณาเลือกกะที่ต้องการขอ OT',true);
   const requestedMinutes=Number($('hr-ot-minutes').value);
   const response=await getApi('/api/hr/request-ot',token,{method:'POST',body:JSON.stringify({
     employeeId:option.dataset.employeeId,shiftId:option.value,
     planned:$('hr-ot-planned').value==='planned',requestedMinutes,
     reason:$('hr-ot-reason').value.trim(),
   })}).catch(()=>null);
   if(!response?.ok)return note('บันทึกคำขอ OT ไม่สำเร็จ',true);
   note('ส่งคำขอ OT แล้ว รอผู้จัดการอนุมัติก่อนคิดค่าจ้าง');
   await refresh();
 });
 $('hr-replacement').addEventListener('submit',async e=>{
   e.preventDefault();
   const r=await getApi('/api/hr/request-substitute',token,{
     method:'POST',body:JSON.stringify({
       originalAssignmentId:$('hr-original-assignment').value,
       newTemplateId:$('hr-replacement-template').value,
       reason:$('hr-replacement-reason').value.trim(),
     }),
   }).catch(()=>null);
   if(!r?.ok)return note('บันทึกกะทำงานแทนไม่สำเร็จ (อาจมีคำขอค้างอยู่)',true);
   note('บันทึกแล้ว กะเดิมยังไม่ถูกนับว่าขาดงานจนกว่าผู้จัดการจะตรวจสอบ');
   await refresh();
 });
 $('hr-seed').addEventListener('click',async()=>{
   const r=await getApi('/api/hr/seed-shifts',token,{method:'POST',body:JSON.stringify({stationId})});
   if(!r.ok)return note('ตั้งกะมาตรฐานไม่สำเร็จ',true);
   note('เตรียมกะเช้า–บ่าย–ดึกแล้ว');await refresh();
 });
 $('hr-add-employee').addEventListener('submit',async e=>{
   e.preventDefault();
   const wageSatang=bahtToSatang($('hr-wage').value.trim());
   if(!wageSatang)return note('ค่าจ้างไม่ถูกต้อง',true);
   const r=await getApi('/api/hr/employees',token,{method:'POST',body:JSON.stringify({
     stationId,employeeCode:$('hr-employee-code').value.trim(),
     name:$('hr-employee-name').value.trim(),wageType:$('hr-wage-type').value,
     wageSatang,payrollFrequency:$('hr-frequency').value,
   })}).catch(()=>null);
   if(!r?.ok)return note('เพิ่มพนักงานไม่สำเร็จ ตรวจสอบว่ารหัสซ้ำหรือไม่',true);
   note('เพิ่มพนักงานแล้ว');await refresh();
 });
 $('hr-schedule').addEventListener('submit',async e=>{
   e.preventDefault();
   const r=await getApi('/api/hr/assign-shift',token,{method:'POST',body:JSON.stringify({
     stationId,employeeId:$('hr-select-employee').value,
     templateId:$('hr-select-template').value,date:$('hr-shift-date').value,
   })}).catch(()=>null);
   if(!r?.ok)return note('จัดกะไม่สำเร็จ',true);
   note('บันทึกตารางกะแล้ว');await refresh();
 });
 await refresh();
}

async function stationFinanceWorkspace(token,stationId,target) {
  if(!target)return;
  target.innerHTML = `
    <div class="divider"></div>
    <div class="finance-heading">
      <h2>รายการเติมเงินรอตรวจสอบ</h2>
      <button id="finance-refresh" class="button secondary" type="button">
        <i data-ui-icon="receipt"></i>โหลดรายการใหม่
      </button>
    </div>
    <p class="hint">ตรวจสอบเงินเข้าบัญชีธนาคารของปั๊มจริงก่อนอนุมัติ ไม่เพิ่มวงเงินจากการแนบสลิปเพียงอย่างเดียว</p>
    <div id="pending-topup-list" class="module-list" aria-live="polite"></div>
    <p id="finance-error" class="notice" role="status" hidden></p>
  `;
  const list=target.querySelector('#pending-topup-list');
  const error=target.querySelector('#finance-error');
  const refresh=target.querySelector('#finance-refresh');
  async function load(){
    refresh.disabled=true;
    list.replaceChildren();
    try{
      const res=await getApi('/api/topup/pending?stationId='+encodeURIComponent(stationId),token);
      if(!res.ok)throw new Error('not_available');
      error.hidden=true;
      if(!res.data.requests?.length){
        const empty=document.createElement('p');empty.textContent='ไม่มีรายการเติมเงินที่รอตรวจสอบ';
        list.appendChild(empty);return;
      }
      for(const record of res.data.requests){
        const item=document.createElement('section');item.className='module-item finance-item';
        const name=document.createElement('strong');name.textContent=record.companyName;
        const amount=document.createElement('div');amount.className='money';
        amount.textContent=bahtText(record.amountSatang);
        const meta=document.createElement('p');
        meta.textContent='ธนาคาร '+record.bankCode+' · '+new Date(record.requestedAt).toLocaleString('th-TH');
        const state=document.createElement('p');state.className='finance-status';
        state.textContent='รอตรวจสอบเงินเข้าจริง — ยังไม่เพิ่มวงเงิน';
        const slipButton=document.createElement('button');
        slipButton.className='button secondary';slipButton.type='button';slipButton.textContent='ดูหลักฐานโอนเงิน';
        const slipStatus=document.createElement('small');slipStatus.setAttribute('role','status');
        slipButton.addEventListener('click',async()=>{
          slipButton.disabled=true;slipStatus.textContent='กำลังโหลดสลิป…';
          try{
            const r=await fetch('/api/evidence/topup-slip?requestId='+encodeURIComponent(record.requestId),{
              headers:{authorization:'Bearer '+token},cache:'no-store'});
            if(!r.ok)throw new Error('unavailable');
            const blob=await r.blob();if(blob.size>5*1024*1024)throw new Error('too_large');
            const objectUrl=URL.createObjectURL(blob);
            const a=document.createElement('a');a.href=objectUrl;a.download='oilstation-slip-'+record.requestId+'.jpg';
            a.style.display='none';document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
            slipStatus.textContent='ดาวน์โหลดสลิปแล้ว โปรดเทียบกับรายการเงินเข้าธนาคารก่อนอนุมัติ';
          }catch{slipStatus.textContent='ไม่สามารถดูสลิปได้ กรุณาลองใหม่';}
          finally{slipButton.disabled=false;}
        });
        const refLabel=document.createElement('label');refLabel.className='field';
        refLabel.textContent='เลขอ้างอิงจากรายการเงินเข้าธนาคาร';
        const reference=document.createElement('input');
        reference.placeholder='ตรวจสอบจากรายการธนาคาร';reference.maxLength=120;
        reference.autocomplete='off';reference.setAttribute('aria-label','เลขอ้างอิงรายการโอนที่ตรวจสอบแล้ว');
        refLabel.appendChild(reference);
        const confirmLabel=document.createElement('label');confirmLabel.className='finance-confirm';
        const check=document.createElement('input');check.type='checkbox';
        confirmLabel.append(check,document.createTextNode('ตรวจยอดเงิน ชื่อบัญชีปลายทาง และเลขอ้างอิงกับรายการเงินเข้าจริงแล้ว'));
        const buttons=document.createElement('div');buttons.className='finance-actions';
        const approve=document.createElement('button');approve.type='button';approve.className='button primary';
        approve.textContent='อนุมัติเมื่อเงินเข้าแล้ว';
        const reject=document.createElement('button');reject.type='button';reject.className='button secondary';
        reject.textContent='ปฏิเสธรายการ';
        const reviewStatus=document.createElement('small');reviewStatus.setAttribute('role','status');
        async function review(approved){
          const ref=reference.value.trim();
          if(approved&&(!check.checked||ref.length<6)){
            reviewStatus.textContent='ต้องตรวจเงินเข้าธนาคารจริง และกรอกเลขอ้างอิงอย่างน้อย 6 ตัวก่อนอนุมัติ';
            return;
          }
          const question=approved
            ? 'ยืนยันว่าเงินเข้าธนาคารจริงตรงกับรายการนี้ และอนุมัติเพิ่มวงเงินหลังตัดหนี้ค้าง?'
            : 'ปฏิเสธรายการเติมเงินนี้?';
          if(!window.confirm(question))return;
          approve.disabled=true;reject.disabled=true;reviewStatus.textContent='กำลังบันทึกการตรวจสอบ…';
          try{
            const r=await getApi('/api/topup/review',token,{method:'POST',body:JSON.stringify({
              requestId:record.requestId,approved,
              bankReceived:approved&&check.checked,
              bankReference:approved?ref:null,
            })});
            if(!r.ok){
              reviewStatus.textContent='อนุมัติไม่สำเร็จ ('+responseError(r.data)+')';
              approve.disabled=false;reject.disabled=false;return;
            }
            await load();
          }catch{
            reviewStatus.textContent='ไม่สามารถยืนยันผลการอนุมัติได้ กรุณาโหลดคิวใหม่ก่อนทำซ้ำ';
          }
          finally{approve.disabled=false;reject.disabled=false;}
        }
        approve.addEventListener('click',()=>review(true));
        reject.addEventListener('click',()=>review(false));
        buttons.append(approve,reject);
        item.append(name,amount,meta,state,slipButton,slipStatus,refLabel,
          confirmLabel,buttons,reviewStatus);list.appendChild(item);
      }
    }catch{
      error.textContent='โหลดรายการเติมเงินไม่สำเร็จ กรุณาลองอีกครั้ง';
      error.dataset.tone='error';error.hidden=false;
    }finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',()=>load());
  await load();
}

async function stationCorporateWorkspace(accessToken,stationId,target) {
  if (!target) return;
  target.innerHTML = `
    <div class="divider"></div><h2>ลูกค้าบริษัท</h2>
    <p>เปิดบัญชีลูกค้าประจำปั๊ม และส่งคำเชิญผู้ดูแลบริษัทคนแรก</p>
    <form id="customer-create" class="coupon-form">
      <label class="field">ชื่อบริษัทลูกค้า <input id="customer-name" maxlength="200" required placeholder="เช่น บริษัท ขนส่ง จำกัด"></label>
      <label class="field">เลขประจำตัวผู้เสียภาษี (ถ้ามี) <input id="customer-tax" inputmode="numeric" maxlength="13" placeholder="13 หลัก"></label>
      <label class="field">อีเมลผู้ดูแลคนแรก <input id="customer-email" type="email" required maxlength="320" placeholder="admin@company.com"></label>
      <label class="field">เครดิตเทอม (วัน) <input id="customer-terms" type="number" min="0" max="365" value="30" required></label>
      <label class="field">กำหนดวันครบกำหนด <select id="customer-due">
        <option value="per_fill">นับจากแต่ละรายการเติม</option>
        <option value="statement">สรุปยอดตามรอบบิล</option>
      </select></label>
      <label class="field" id="customer-close-wrap" hidden>วันที่ปิดรอบบิล <input id="customer-close" type="number" min="1" max="31" value="15"></label>
      <button class="button primary" id="customer-create-btn" type="submit"><i data-ui-icon="building"></i>เปิดบัญชีบริษัท</button>
    </form>
    <div id="customer-invite-area" hidden>
      <p class="hint" id="customer-invite-status"></p>
      <button class="button primary" type="button" id="customer-invite-btn">สร้างคำเชิญ Admin คนแรก</button>
      <input readonly hidden id="customer-invite-link" aria-label="ลิงก์คำเชิญบริษัท">
      <button class="button secondary" hidden type="button" id="customer-invite-copy">คัดลอกลิงก์เชิญ</button>
    </div>
    <p id="customer-notice" class="notice" role="status" hidden></p>
    <div class="divider"></div>
    <h3>เชื่อมบริษัทเดิมกับปั๊มนี้</h3>
    <p>บริษัทที่มีหลายปั๊มจะต้องให้ Corporate Admin อนุมัติการเชื่อมบัญชีใหม่</p>
    <form id="customer-link-form" class="coupon-form">
      <label class="field">Company ID <input id="existing-company" required placeholder="รหัสบริษัท (UUID)"></label>
      <button class="button secondary" type="submit">ส่งคำขอเชื่อมบัญชี</button>
    </form>
    <p id="link-notice" class="notice" role="status" hidden></p>
  `;
  const $=id=>document.getElementById(id);
  const note=(id,text,error=false)=>{
    $(id).textContent=text;$(id).hidden=false;$(id).dataset.tone=error?'error':'neutral';
  };
  let createdCompanyId=null;
  $('customer-due').addEventListener('change',()=>{
    $('customer-close-wrap').hidden=$('customer-due').value!=='statement';
  });
  $('customer-create').addEventListener('submit',async event=>{
    event.preventDefault();
    const name=$('customer-name').value.trim();
    const contactEmail=$('customer-email').value.trim();
    const taxId=$('customer-tax').value.trim();
    if(taxId&&!/^\d{13}$/.test(taxId)) return note('customer-notice','เลขภาษีต้องมี 13 หลัก',true);
    const data={
      stationId,name,taxId:taxId||null,contactEmail,
      paymentTermsDays:Number($('customer-terms').value),
      dueMode:$('customer-due').value,
      statementCloseDay:$('customer-due').value==='statement'?Number($('customer-close').value):null,
    };
    const btn=$('customer-create-btn');btn.disabled=true;
    note('customer-notice','กำลังเปิดบัญชี…');
    try {
      const response=await getApi('/api/station/customers',accessToken,{
        method:'POST',body:JSON.stringify(data),
      });
      if(!response.ok) return note('customer-notice',
        'เปิดบัญชีไม่สำเร็จ ('+responseError(response.data)+')',true);
      createdCompanyId=response.data.customer.companyId;
      $('customer-invite-area').hidden=false;
      $('customer-invite-status').textContent='สร้างบริษัทแล้ว: '+response.data.customer.name+
        ' (ยอดเงินเริ่มต้น 0 บาท) กรุณาเชิญ Admin คนแรก';
      note('customer-notice','เปิดบัญชีบริษัทเรียบร้อย');
    }catch{
      note('customer-notice','ไม่สามารถยืนยันผลการเปิดบัญชีได้ กรุณาตรวจสอบก่อนลองใหม่',true);
    }finally{btn.disabled=false;}
  });
  $('customer-invite-btn').addEventListener('click',async()=>{
    if(!createdCompanyId) return;
    const btn=$('customer-invite-btn');btn.disabled=true;
    try{
      const r=await getApi('/api/station/invite-first-admin',accessToken,{
        method:'POST',body:JSON.stringify({
          stationId,companyId:createdCompanyId,email:$('customer-email').value.trim(),
        }),
      });
      if(!r.ok) return note('customer-notice','เชิญ Admin ไม่สำเร็จ ('+responseError(r.data)+')',true);
      $('customer-invite-link').value=r.data.invitation.inviteUrl;
      $('customer-invite-link').hidden=false;
      $('customer-invite-copy').hidden=false;
      note('customer-notice',r.data.invitation.delivery==='email_accepted'?
        'ผู้ให้บริการรับคำขอส่งอีเมลแล้ว แต่ยังไม่ยืนยันการส่งถึงผู้รับ':
        'สร้างลิงก์เชิญแล้ว ยังไม่ได้ยืนยันการส่งอีเมล กรุณาส่งลิงก์ให้ผู้รับ');
    }catch{note('customer-notice','สร้างคำเชิญไม่สำเร็จ',true);}
    finally{btn.disabled=false;}
  });
  $('customer-invite-copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('customer-invite-link').value);
      $('customer-invite-copy').textContent='คัดลอกแล้ว';
    }catch{$('customer-invite-link').select();}
  });
  $('customer-link-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const companyId=$('existing-company').value.trim();
    const r=await getApi('/api/station/link-company',accessToken,{
      method:'POST',body:JSON.stringify({stationId,companyId}),
    }).catch(()=>null);
    note('link-notice',r?.ok
      ? 'ส่งคำขอแล้ว ต้องให้ Admin บริษัทอนุมัติในบัญชีของเขา'
      : 'ส่งคำขอไม่สำเร็จ กรุณาตรวจสอบ Company ID',!r?.ok);
  });
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
    const error=document.createElement('p');error.setAttribute('role','alert');
    error.textContent='โหลดรายการน้ำมันไม่ได้: '+responseError(res.data);
    error.dataset.tone='error';target.appendChild(error);
    return;
  }
  if(!res.data.fuels?.length){
    const empty=document.createElement('p');empty.className='ws-empty';
    empty.textContent='ยังไม่มีชนิดน้ำมันสำหรับปั๊มนี้ กรุณาตรวจแบรนด์ของปั๊มหรือติดต่อผู้ดูแล';
    target.appendChild(empty);return;
  }
  for (const fuel of res.data.fuels||[]) {
    const row=document.createElement('div');row.className='fuel-row';
    const name=document.createElement('strong');name.textContent=fuel.name;
    const controls=document.createElement('div');controls.className='fuel-row-controls';
    const toggle=document.createElement('label');
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=fuel.enabled;
    checkbox.setAttribute('aria-label','เปิดขาย '+fuel.name);
    toggle.append(checkbox,document.createTextNode(' เปิดขาย'));
    const price=document.createElement('input');
    price.inputMode='decimal';price.value=fuel.publicPrice??'';
    price.placeholder='บาทต่อลิตร';price.autocomplete='off';price.setAttribute('aria-label','ราคาบาทต่อลิตรสำหรับ '+fuel.name);
    const save=document.createElement('button');save.type='button';save.className='button secondary';
    save.textContent='บันทึก';
    const status=document.createElement('small');status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    save.addEventListener('click',async()=>{
      if (!/^[0-9]{1,8}(?:\.[0-9]{1,4})?$/.test(price.value) || Number(price.value)<=0) {
        setUiStatus(status,'กรุณาใส่ราคาบาทต่อลิตรเป็นตัวเลขมากกว่า 0','error');price.focus();return;
      }
      save.disabled=true;setUiStatus(status,'กำลังบันทึกราคาน้ำมัน…','neutral');
      try {
        const res=await getApi('/api/station-fuel-config',accessToken,{
          method:'POST',body:JSON.stringify({
            stationId,stationFuelId:fuel.id,publicPrice:price.value,enabled:checkbox.checked,
          }),
        });
        setUiStatus(status,res.ok?
          (checkbox.checked?'บันทึกราคาและเปิดขายแล้ว':'บันทึกราคาแล้ว สถานะปิดขาย'):
          'บันทึกไม่ได้: '+responseError(res.data),res.ok?'success':'error');
      } catch {setUiStatus(status,'เชื่อมต่อไม่ได้ กรุณาลองบันทึกอีกครั้ง','error');}
      finally {save.disabled=false;}
    });
    controls.append(toggle,price,save);
    row.append(name,controls,status);target.appendChild(row);
  }
}

async function stationPumpWorkspace(token,stationId,target,canReview=false) {
 if(!target)return;
 target.innerHTML=`
   <div class="divider"></div><h2>รับคูปองเติมน้ำมัน</h2>
   <p>สแกน QR ของคนขับ แล้วถ่ายรูปทะเบียนเพื่อเข้าสู่การตรวจสอบ</p>
   <form id="scan-form" class="coupon-form">
     <label class="field">รหัส QR คูปอง <input id="scan-payload" required autocomplete="off" placeholder="สแกน QR หรือวางข้อมูลคูปอง"></label>
     <button class="button primary" type="submit"><i data-ui-icon="scan"></i>ตรวจสอบคูปอง</button>
   </form>
   <div class="camera-area os-mobile-camera">
     <button id="start-camera" type="button" class="button secondary"><i data-ui-icon="camera"></i>เปิดกล้องสแกน QR</button>
     <button id="stop-camera" type="button" class="button secondary" hidden>ปิดกล้อง</button>
     <video id="scan-video" playsinline muted autoplay hidden></video>
   </div>
   <p id="pump-notice" class="notice" role="status" hidden></p>
   <div id="coupon-inspection" hidden>
     <div class="module-item">
       <h3 id="pump-station-name"></h3>
       <p id="pump-fuel"></p>
       <p id="pump-plate"></p>
       <strong id="pump-limit"></strong>
       <p id="pump-expiry"></p>
     </div>
     <form id="plate-photo-form" class="coupon-form">
       <label class="field">ถ่ายภาพทะเบียนรถ (จำเป็นทุกคูปอง)
         <input type="file" id="pump-plate-photo" required accept="image/jpeg,image/png" capture="environment">
       </label>
       <button type="submit" class="button primary"><i data-ui-icon="camera"></i>ส่งรูปตรวจทะเบียน</button>
     </form>
     <p class="hint">ต้องให้ระบบตรวจภาพทะเบียนและยืนยันความถูกต้องก่อนเริ่มเติมน้ำมัน พนักงานไม่สามารถข้ามขั้นตอนนี้ได้</p>
     <section id="plate-verification" class="plate-verification" hidden aria-label="ผลตรวจทะเบียน">
       <div class="section-title"><i data-ui-icon="shield"></i>ยืนยันหลักฐานทะเบียน</div>
       <p id="plate-verification-status" role="status" aria-live="polite">ยังไม่ได้ตรวจ</p>
       <button type="button" id="plate-ocr-retry" class="button secondary">ตรวจด้วย OCR อีกครั้ง</button>
       <form id="plate-supervisor-form" class="coupon-form">
         <label class="field">ทะเบียนที่เห็นจากภาพจริง
           <input id="plate-supervisor-value" autocomplete="off" maxlength="40" placeholder="ตัวอย่าง กข 1234" required>
         </label>
         <p class="hint">สำหรับแคชเชียร์/ผู้จัดการที่ไม่ได้ถ่ายภาพนี้เท่านั้น ต้องตรวจภาพจริงและตรงกับทะเบียนคูปอง ห้ามยืนยันจากข้อความ OCR อย่างเดียว</p>
         <button class="button primary" type="submit">ยืนยันทะเบียนตรงกับภาพจริง</button>
         <button id="plate-reject" class="button secondary" type="button">ไม่ผ่าน — ปฏิเสธภาพนี้</button>
       </form>
     </section>
     <div id="fuel-start-panel" hidden>
       <button type="button" id="start-verified-fueling" class="button primary">เริ่มเติมน้ำมัน</button>
       <p id="fuel-session-status" role="status"></p>
     </div>
     <section id="fuel-proof-panel" class="plate-verification" hidden>
       <div class="section-title">หลักฐานหัวจ่ายและใบเสร็จ</div>
       <p class="hint">บันทึกภาพทั้งสองรายการก่อนให้ผู้จัดการตรวจความถูกต้อง ระบบยังไม่ตัดยอดจากการอัปโหลดภาพ</p>
       <form id="fuel-proof-form" class="coupon-form">
         <label class="field">รูปหน้าจอหัวจ่าย
           <input id="pump-meter-file" type="file" accept="image/jpeg,image/png" capture="environment" required>
         </label>
         <label class="field">รูปใบเสร็จ
           <input id="fuel-receipt-file" type="file" accept="image/jpeg,image/png" capture="environment" required>
         </label>
         <button id="fuel-proof-submit" class="button primary" type="submit">ส่งหลักฐานการเติมน้ำมัน</button>
       </form>
       <p id="fuel-proof-status" role="status"></p>
       <button type="button" class="button secondary" id="finish-verified-fueling" hidden>ตรวจหลักฐานและปิดยอดเมื่อผู้จัดการอนุมัติแล้ว</button>
     </section>
   </div>
   <section id="plate-review-manager" class="plate-verification" hidden></section>
   <section id="fuel-review-manager" class="plate-verification" hidden></section>
 `;
 const $=id=>document.getElementById(id);
 if(canReview)mountPlateReviewInbox({target:$('plate-review-manager'),token,stationId});
 if(canReview)mountFuelReviewInbox({target:$('fuel-review-manager'),token,stationId});
 const report=(text,error=false)=>{
   const out=$('pump-notice');out.textContent=text;out.hidden=false;
   out.dataset.tone=error?'error':'neutral';
 };
 let current=null,stream=null,scanTimer=null,reading=false,startingCamera=false,photoId=null,sessionId=null;
 let fuelProofIds={};
 const photoPanel=$('plate-verification');
 const photoStatus=$('plate-verification-status');
 const photoRetry=$('plate-ocr-retry');
 const reviewerForm=$('plate-supervisor-form');
 const setPhotoStatus=(text,verified=false)=>{
   photoStatus.textContent=text;
   photoPanel.dataset.verified=verified?'true':'false';
   photoRetry.hidden=verified;reviewerForm.hidden=verified;
   $('fuel-start-panel').hidden=!verified||Boolean(sessionId);
 };
 const stop=()=>{
   if(scanTimer)clearInterval(scanTimer);scanTimer=null;
   if(stream){for(const track of stream.getTracks())track.stop();}
   stream=null;
   $('scan-video').srcObject=null;$('scan-video').hidden=true;
   target.querySelector('.os-mobile-camera')?.classList.remove('is-scanning');
   $('stop-camera').hidden=true;$('start-camera').hidden=false;
 };
 async function inspect(){
   const payload=$('scan-payload').value.trim();
   const res=await getApi('/api/station/scan-qr',token,{
     method:'POST',body:JSON.stringify({qrPayload:payload}),
   }).catch(()=>null);
   if(!res?.ok){
     current=null;$('coupon-inspection').hidden=true;
     report('ไม่สามารถใช้ QR นี้ได้ กรุณาตรวจสิทธิ์ สถานะ และวันหมดอายุ',true);
     return;
   }
   const coupon=res.data.coupon;
   if(coupon.stationId!==stationId){
     current=null;$('coupon-inspection').hidden=true;
     return report('คูปองนี้ใช้กับปั๊มอื่น ไม่สามารถรับเติมได้',true);
   }
   current=coupon;photoId=null;sessionId=null;fuelProofIds={};photoPanel.hidden=true;
   $('finish-verified-fueling').hidden=true;
   $('fuel-start-panel').hidden=true;$('fuel-proof-panel').hidden=true;
   $('start-verified-fueling').hidden=false;$('coupon-inspection').hidden=false;
   $('pump-station-name').textContent=coupon.stationName;
   $('pump-fuel').textContent='น้ำมัน: '+coupon.fuelName;
   $('pump-plate').textContent='ทะเบียน: '+(coupon.plate||'ไม่ผูกทะเบียน (ยังต้องถ่ายภาพ)');
   $('pump-limit').textContent='วงเงินสูงสุด '+bahtText(coupon.maxAmountSatang);
   $('pump-expiry').textContent='หมดอายุ: '+new Date(coupon.expiresAt).toLocaleString('th-TH');
   report('ตรวจ QR แล้ว กรุณาถ่ายภาพทะเบียน');
 }
 $('scan-form').addEventListener('submit',async e=>{e.preventDefault();stop();await inspect();});
 $('plate-photo-form').addEventListener('submit',async e=>{
   e.preventDefault();
   if(!current)return;
   const file=$('pump-plate-photo').files?.[0];
   if(!file || !['image/jpeg','image/png'].includes(file.type) || file.size>5*1024*1024 || file.size<64)
     return report('ภาพต้องเป็น JPEG/PNG และขนาดไม่เกิน 5 MB',true);
   const button=$('plate-photo-form').querySelector('button');
   button.disabled=true;report('กำลังอัปโหลดภาพทะเบียนแบบส่วนตัว…');
   try{
     const couponIdAtUpload=current.couponId;
     const endpoint='/api/evidence/plate?stationId='+encodeURIComponent(stationId)
       +'&couponId='+encodeURIComponent(current.couponId);
     const res=await fetch(endpoint,{
       method:'POST',headers:{authorization:'Bearer '+token,'content-type':file.type},
       body:file,cache:'no-store',
     });
     const data=await res.json().catch(()=>({}));
     if(!current || current.couponId!==couponIdAtUpload)return;
     if(res.ok && data.evidence?.photoId){
       photoId=data.evidence.photoId;photoPanel.hidden=false;
       setPhotoStatus('ภาพอยู่ในพื้นที่จัดเก็บส่วนตัว กำลังตรวจ OCR…');
       await runPlateOcr();
     } else report('ส่งภาพไม่สำเร็จ ('+(data.error||'service_unavailable')+')',true);
   }catch{report('การอัปโหลดล้มเหลว',true);}
   finally{button.disabled=false;}
 });

 async function runPlateOcr(){
   if(!photoId)return;
   const pendingPhotoId=photoId;photoRetry.disabled=true;
   setPhotoStatus('กำลังอ่านทะเบียนจากภาพส่วนตัว…');
   try{
     const res=await getApi('/api/evidence/plate/ocr',token,{
       method:'POST',body:JSON.stringify({photoId:pendingPhotoId}),
     });
     if(photoId!==pendingPhotoId)return;
     if(res.ok && res.data.result?.verified){
       setPhotoStatus('ตรวจทะเบียนผ่าน ✓ หลักฐานได้รับการยืนยัน',true);
       report('ทะเบียนผ่านการตรวจสอบ OCR');
     }else{
       setPhotoStatus(res.ok ? 'OCR ไม่แน่ชัดหรือตรวจพบทะเบียนต่างจากคูปอง — ต้องให้แคชเชียร์/ผู้จัดการตรวจภาพจริง' :
         'OCR ยังไม่พร้อมใช้งาน — รอผู้มีสิทธิ์ตรวจภาพจริง');
       report('ยังไม่อนุญาตเริ่มเติมน้ำมัน',true);
     }
   }catch{setPhotoStatus('เชื่อมต่อ OCR ไม่สำเร็จ — รอผู้จัดการตรวจภาพ');}
   finally{photoRetry.disabled=false;}
 }
 photoRetry.addEventListener('click',runPlateOcr);
 async function supervisorDecision(approved){
   if(!photoId)return report('กรุณาอัปโหลดภาพก่อน',true);
   const pendingPhotoId=photoId;
   const plate=$('plate-supervisor-value').value.trim();
   if(approved&&!plate)return report('กรุณากรอกทะเบียนที่เห็นจากภาพจริง',true);
   const controls=[...reviewerForm.querySelectorAll('button')];
   controls.forEach(b=>b.disabled=true);
   try{
     const res=await getApi('/api/evidence/plate/review',token,{
       method:'POST',body:JSON.stringify({photoId:pendingPhotoId,approved,observedPlate:plate}),
     });
     if(photoId!==pendingPhotoId)return;
     if(res.ok){
       setPhotoStatus(approved?'แคชเชียร์/ผู้จัดการตรวจทะเบียนผ่าน ✓':'ปฏิเสธภาพนี้ ต้องถ่ายภาพใหม่',approved);
       report(approved?'หลักฐานทะเบียนได้รับการยืนยันแล้ว':'ภาพถูกปฏิเสธ กรุณาถ่ายภาพใหม่',!approved);
       if(!approved){photoId=null;photoPanel.hidden=true;}
     }else report(res.data?.error==='plate_mismatch'?
       'ทะเบียนจริงไม่ตรงคูปอง ต้องให้บริษัทออก QR ใหม่':
       'ยืนยันไม่ได้ — ตรวจสิทธิ์ผู้อนุมัติและตรวจว่าผู้อนุมัติไม่ใช่คนถ่ายภาพ',true);
   }catch{report('เชื่อมต่อระบบตรวจทะเบียนไม่สำเร็จ',true);}
   finally{controls.forEach(b=>b.disabled=false);}
 }
 reviewerForm.addEventListener('submit',async e=>{e.preventDefault();await supervisorDecision(true);});
 $('plate-reject').addEventListener('click',()=>supervisorDecision(false));
 $('start-verified-fueling').addEventListener('click',async()=>{
   if(!photoId||!current||sessionId)return;
   const proof=photoId,button=$('start-verified-fueling');
   button.disabled=true;
   $('fuel-session-status').textContent='กำลังตรวจหลักฐานและล็อกราคา…';
   try{
     const response=await getApi('/api/fuel/start',token,{
       method:'POST',body:JSON.stringify({photoId:proof}),
     });
     if(photoId!==proof)return;
     if(!response.ok||!response.data.session?.id)throw new Error('not_started');
     sessionId=response.data.session.id;
     $('fuel-proof-panel').hidden=false;
     button.hidden=true;
     $('fuel-session-status').textContent='เริ่มเติมแล้ว · ล็อกราคา ณ เวลาเริ่มเติม · ต้องเก็บหลักฐานหัวจ่ายและใบเสร็จก่อนปิดยอด';
     report('เริ่มเติมสำเร็จ กำลังรอหลักฐานการเติมน้ำมัน');
   }catch{
     $('fuel-session-status').textContent='เริ่มเติมไม่สำเร็จ ตรวจคูปองและหลักฐานอีกครั้ง';
   }finally{button.disabled=false;}
 });

 $('fuel-proof-form').addEventListener('submit',async event=>{
   event.preventDefault();
   if(!sessionId)return report('ยังไม่ได้เริ่มเติมน้ำมัน',true);
   const uploads=[['pump_display',$('pump-meter-file').files?.[0]],
     ['receipt',$('fuel-receipt-file').files?.[0]]];
   if(uploads.some(([,file])=>!file||!['image/jpeg','image/png'].includes(file.type)
       ||file.size<64||file.size>5*1024*1024))
     return report('ต้องส่ง JPEG/PNG ทั้งสองภาพ ขนาดไม่เกินภาพละ 5 MB',true);
   const button=$('fuel-proof-submit');button.disabled=true;
   const status=$('fuel-proof-status');
   status.textContent='กำลังส่งหลักฐานแบบส่วนตัว…';
   const activeSession=sessionId;
   try{
     const preview=[];
     for(const [kind,file] of uploads){
       const response=await fetch('/api/evidence/fuel?sessionId='+encodeURIComponent(activeSession)
         +'&kind='+kind,{method:'POST',headers:{authorization:'Bearer '+token,
           'content-type':file.type},body:file,cache:'no-store'});
       if(!response.ok)throw new Error('evidence_failed');
       const saved=await response.json().catch(()=>({}));
       const evidenceId=saved.evidence?.evidenceId;
       if(evidenceId){
         fuelProofIds[kind]=evidenceId;
         const ocr=await getApi('/api/evidence/fuel/ocr',token,{
           method:'POST',body:JSON.stringify({evidenceId}),
         }).catch(()=>null);
         preview.push(ocr?.ok?kind+': OCR รอผู้จัดการตรวจ':
           kind+': รับภาพแล้ว OCR ยังไม่พร้อม');
       }
     }
     if(sessionId!==activeSession)return;
     status.textContent='รับภาพแล้ว · '+preview.join(' / ')+' · ยังไม่ปิดยอด ไม่ตัดวงเงิน';
     $('finish-verified-fueling').hidden=!(fuelProofIds.pump_display&&fuelProofIds.receipt);
   }catch{
     status.textContent='ส่งหลักฐานไม่ครบ กรุณาตรวจสอบรูปภาพและลองส่งใหม่';
   }finally{button.disabled=false;}
 });

 $('finish-verified-fueling').addEventListener('click',async()=>{
   if(!sessionId||!fuelProofIds.pump_display||!fuelProofIds.receipt)return;
   const button=$('finish-verified-fueling');button.disabled=true;
   const status=$('fuel-proof-status');
   status.textContent='กำลังตรวจการอนุมัติภาพและยืนยันยอดก่อนปิดรายการ…';
   try{
     const result=await getApi('/api/fuel/finish',token,{
       method:'POST',body:JSON.stringify({
         sessionId,pumpEvidenceId:fuelProofIds.pump_display,
         receiptEvidenceId:fuelProofIds.receipt,
       }),
     });
     if(!result.ok||result.data.session?.status!=='completed')
       throw new Error('not_reviewed');
     status.textContent='ปิดรายการสำเร็จ · บันทึกยอดตามราคาที่ล็อกไว้แล้ว';
     button.hidden=true;$('fuel-proof-form').hidden=true;
     report('รายการเติมน้ำมันเสร็จสมบูรณ์');
   }catch{
     status.textContent='ยังปิดยอดไม่ได้ — ต้องให้ผู้จัดการตรวจทั้งสองภาพ และยอดหัวจ่ายกับใบเสร็จต้องตรงกัน';
   }finally{button.disabled=false;}
 });
 $('stop-camera').addEventListener('click',stop);
 const startCamera=async()=>{
   if(stream||startingCamera)return;
   if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia)
     return report('เบราว์เซอร์นี้ยังไม่รองรับการสแกน QR แบบสด กรุณาเปิดด้วย Chrome บน Android หรือใส่รหัสคูปองด้วยตนเอง',true);
   startingCamera=true;
   try{
     const supported=await BarcodeDetector.getSupportedFormats();
     if(!supported.includes('qr_code'))throw new Error('no_qr');
     const detector=new BarcodeDetector({formats:['qr_code']});
     const video=$('scan-video');
     stream=await navigator.mediaDevices.getUserMedia({
       video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},
       audio:false,
     });
     video.srcObject=stream;video.hidden=false;
     $('stop-camera').hidden=false;$('start-camera').hidden=true;
     target.querySelector('.os-mobile-camera')?.classList.add('is-scanning');
     await video.play();
     report('กำลังสแกน QR คูปอง… เล็งกล้องไปที่ QR');
     scanTimer=setInterval(async()=>{
       if(reading||!stream||document.hidden||video.readyState<2)return;
       reading=true;
       try{
         const found=await detector.detect(video);
         if(found.length&&typeof found[0].rawValue==='string'){
           $('scan-payload').value=found[0].rawValue;
           stop();await inspect();
         }
       }catch{}
       finally{reading=false;}
     },450);
   }catch{
     stop();
     report('เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์แล้วลองใหม่ หรือใส่รหัสคูปองด้วยตนเอง',true);
   }finally{startingCamera=false;}
 };
 $('start-camera').addEventListener('click',startCamera);
 target.addEventListener('oilstation:leave-pump',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});

}

async function platformWorkspace(accessToken) {
  const target=document.getElementById('platform-workspace');
  if (!target) return;

  target.innerHTML = `
    <div class="os-station-layout">
      <section class="os-create-station" aria-labelledby="os-create-heading">
        <span class="os-onboarding-label">ขั้นตอนที่ 1 / ข้อมูลปั๊ม</span>
        <h3 id="os-create-heading">สร้างปั๊มน้ำมัน</h3>
        <p class="os-section-copy">กรอกข้อมูลสาขาและเลือกบริการ ยังไม่ต้องเลือกแพ็กเกจราคา</p>
        <form class="coupon-form" id="new-station-form">
          <label class="field">ชื่อองค์กร / เจ้าของกิจการ
            <input id="org-name" autocomplete="organization" maxlength="160" required placeholder="เช่น บริษัท ตัวอย่าง จำกัด"></label>
          <label class="field">ชื่อปั๊มน้ำมัน / สาขา
            <input id="station-name" maxlength="160" required placeholder="เช่น สถานี A"></label>
          <label class="field">แบรนด์ปั๊มน้ำมัน
            <select id="brand-select" required></select></label>
          <div class="module-choices" role="group" aria-label="บริการที่จะเปิดใช้งาน">
            <label><input type="checkbox" id="module-qr" checked> QR Coupon</label>
            <label><input type="checkbox" id="module-hr"> HR & Payroll</label>
          </div>
          <p class="hint">ระบบเตรียมชนิดน้ำมันตามแบรนด์ไว้ให้ แต่ยังไม่เปิดขายจนกว่าจะตั้งราคาและเปิดใช้งาน</p>
          <button class="button primary" id="new-station-submit" type="submit"><i data-ui-icon="building"></i>สร้างปั๊ม</button>
          <p id="platform-notice" class="notice" hidden role="status"></p>
        </form>
      </section>
      <section class="os-station-directory" aria-labelledby="os-directory-heading">
        <span class="os-onboarding-label">ขั้นตอนที่ 2 / เชิญเจ้าของปั๊ม</span>
        <h3 id="os-directory-heading">ปั๊มที่สร้างแล้ว</h3>
        <p class="os-section-copy">เลือกจัดการน้ำมันหรือเชิญเจ้าของปั๊ม เมื่อผู้รับยืนยันคำเชิญแล้ว จึงเลือกแพ็กเกจและวิธีชำระเงินเอง</p>
        <p id="station-count" class="os-directory-count" role="status"></p>
        <div id="station-list" class="module-list"><p>กำลังโหลดรายชื่อปั๊ม…</p></div>
      </section>
    </div>
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
    el('station-count').textContent='ทั้งหมด '+(r.data.stations?.length||0)+' ปั๊ม';
    if (!r.data.stations?.length) {
      const msg=document.createElement('p');msg.textContent='ยังไม่มีปั๊มน้ำมันในระบบ';list.appendChild(msg);
    }
    for (const s of (r.data.stations||[])) {
      const node=document.createElement('div');
      node.className='module-item os-station-card';
      const name=document.createElement('strong');name.className='os-station-card-name';name.textContent=s.stationName;
      const detail=document.createElement('div');detail.className='module-subtitle';
      detail.classList.add('os-station-card-meta');
      detail.textContent=s.organizationName+' · '+s.brandName+' · '+Object.entries(s.modules||{})
        .filter(([,status])=>status==='enabled').map(([module])=>module==='qr_coupon'?'QR Coupon':'HR').join(' + ');
      const manage=document.createElement('button');
      manage.type='button';manage.className='button secondary';
      manage.textContent='จัดการน้ำมัน';
      manage.addEventListener('click',async()=>{
        const editor=el('fuel-editor');
        editor.replaceChildren();
        try{
          await fuelPriceEditor(accessToken,s.id,editor);
          editor.scrollIntoView({block:'start',behavior:'smooth'});
        }catch{notice('เปิดจัดการน้ำมันไม่ได้',true);}
      });
      const actions=document.createElement('div');
      actions.className='os-station-actions';
      actions.append(manage,
        createInviteControl(accessToken,'station',s.id,[['station_owner','เจ้าของปั๊ม']]));
      node.append(name,detail,actions);
      list.appendChild(node);
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

function dashboard(data, session, publicConfig={}) {
 const memberships=data.memberships||[];
 const scopes={
  platform:{title:'แพลตฟอร์ม',modules:['ปั๊มที่ให้บริการ','พนักงานขาย','การเรียกเก็บเงิน']},
  organization:{title:'เจ้าของกิจการ',modules:['บริหารปั๊ม','สมาชิกและสิทธิ์','การเงิน']},
  station:{title:'จัดการปั๊มน้ำมัน',modules:['คูปองเติมน้ำมัน','พนักงานและกะ','อนุมัติรายการ']},
  corporate_company:{title:'บัญชีลูกค้าบริษัท',modules:['คูปองเติมน้ำมัน','วงเงินและยอดใช้','ประวัติเติมน้ำมัน']},
 };
 const active=scopes[memberships[0]?.scopeType]||scopes.station;
 const screens=selectWorkspaceScreens(memberships);
 show(renderWorkspaceShell(screens));root.classList.add('workspace-mode');
 document.getElementById('scope-title').textContent=active.title;
 const scopesNode=document.getElementById('scopes');
 for(const m of memberships){
  const chip=document.createElement('div');chip.className='scope-chip';
  chip.textContent=m.role+' · '+(scopes[m.scopeType]?.title||m.scopeType);
  scopesNode.appendChild(chip);
 }
 const modules=document.getElementById('modules');
 const icons={
  platform:['building','users','receipt'],organization:['fuel','users','wallet'],
  station:['ticket','calendar','clipboard'],corporate_company:['qr','wallet','receipt'],
 }[memberships[0]?.scopeType]||['fuel','users','wallet'];
 active.modules.forEach((name,i)=>{
  const item=document.createElement('div');item.className='module-item menu-module';
  item.append(makeIcon(icons[i]),document.createTextNode(name));modules.appendChild(item);
 });
 // Mount a module on first visit only, keeping form inputs and scroll state intact.
 const mounts=new Map(),opened=new Set();
 const register=(key,fn)=>{
  if(!mounts.has(key))mounts.set(key,[]);
  mounts.get(key).push(fn);
 };
 const mountScreen=key=>{
  if(opened.has(key))return;
  opened.add(key);
  for(const fn of mounts.get(key)||[]){
   Promise.resolve().then(fn).catch(()=>{
    const panel=root.querySelector('[data-ws-screen="'+key+'"]');
    if(!panel)return;
    const error=document.createElement('p');error.className='notice';
    error.dataset.tone='error';error.setAttribute('role','alert');
    error.textContent='โหลดข้อมูลส่วนนี้ไม่ได้ กรุณาเปิดหน้าใหม่หรือตรวจสอบสิทธิ์กับผู้ดูแล';
    panel.appendChild(error);
   });
  }
 };
 if(memberships.some(m=>m.scopeType==='platform'&&m.role==='platform_superadmin')){
  register('stations',()=>platformWorkspace(session.access_token));
  register('billing',()=>mountPlatformSaasBilling({
   target:document.getElementById('platform-saas-billing'),token:session.access_token}));
 }
 const owner=memberships.find(m=>m.scopeType==='station'&&
  ['station_owner','owner'].includes(m.role)&&m.stationId);
 if(owner)register('plan',()=>mountStationPlanChoice({
  target:document.getElementById('station-saas-plan-workspace'),
  token:session.access_token,stationId:owner.stationId}));
 const bill=memberships.find(m=>m.scopeType==='organization'&&
  ['organization_owner','owner','manager','billing_manager'].includes(m.role)&&m.organizationId);
 if(bill)register('billing',()=>mountBillingWorkspace({
  target:document.getElementById('saas-billing-workspace'),token:session.access_token,
  organizationId:bill.organizationId,publishableKey:publicConfig.stripePublishableKey}));
 const attendance=memberships.find(m=>m.scopeType==='station'&&m.stationId);
 if(attendance)register('attendance',()=>mountAttendanceWorkspace({
  target:document.getElementById('attendance-workspace'),
  token:session.access_token,stationId:attendance.stationId}));
 const supervisor=memberships.find(m=>m.scopeType==='station'&&
  ['station_owner','owner','manager','hr_manager'].includes(m.role)&&m.stationId);
 if(supervisor){
  register('reviews',()=>mountAttendanceReview({
   target:document.getElementById('attendance-review-workspace'),
   token:session.access_token,stationId:supervisor.stationId}));
  register('payroll',()=>mountAttendancePayrollPreview({
   target:document.getElementById('attendance-payroll-preview-workspace'),
   token:session.access_token,stationId:supervisor.stationId}));
 }
 const pump=memberships.find(m=>m.scopeType==='station'&&
  ['station_owner','owner','manager','cashier','attendant','pump_staff'].includes(m.role)&&m.stationId);
 let pendingMobileScan=false;
 if(pump)register('pump',async()=>{
  const target=document.getElementById('station-pump-workspace');
  await stationPumpWorkspace(session.access_token,pump.stationId,target,
   ['station_owner','owner','manager','cashier'].includes(pump.role));
  if(pendingMobileScan&&root.querySelector('[data-workspace-shell]')?.dataset.activeScreen==='pump'){
   pendingMobileScan=false;
   target.querySelector('#start-camera')?.click();
  }
 });
 const station=memberships.find(m=>m.scopeType==='station'&&
  ['station_owner','owner','manager'].includes(m.role)&&m.stationId);
 if(station){
  register('hr',()=>hrWorkspace(session.access_token,station.stationId,document.getElementById('hr-workspace')));
  register('fuel',()=>fuelPriceEditor(session.access_token,station.stationId,document.getElementById('station-fuel-workspace')));
  register('finance',()=>stationFinanceWorkspace(session.access_token,station.stationId,document.getElementById('station-finance-workspace')));
  register('customers',()=>stationCorporateWorkspace(session.access_token,station.stationId,document.getElementById('station-customers-workspace')));
  register('invitations',()=>document.getElementById('member-invites')?.appendChild(
   createInviteControl(session.access_token,'station',station.stationId,
    [['manager','ผู้จัดการ'],['cashier','แคชเชียร์'],['attendant','พนักงานปั๊ม']])));
 }
 const corpAdmin=memberships.find(m=>m.scopeType==='corporate_company'&&m.role==='corporate_admin'&&m.corporateCompanyId);
 if(corpAdmin)register('invitations',()=>document.getElementById('member-invites')?.appendChild(
  createInviteControl(session.access_token,'corporate_company',corpAdmin.corporateCompanyId,
   [['coupon_issuer','ผู้ออกคูปอง'],['accountant','บัญชี'],['driver','คนขับรถ']])));
 if(memberships.some(m=>m.scopeType==='corporate_company'))
  register('corporate',()=>corporateWorkspace(session.access_token));
 const shell=root.querySelector('[data-workspace-shell]');
 shell?.addEventListener('oilstation:screenchange',event=>{
  if(event.detail.key!=='pump'){
   pendingMobileScan=false;
   document.getElementById('station-pump-workspace')
    ?.dispatchEvent(new Event('oilstation:leave-pump'));
  }
  mountScreen(event.detail.key);
 });
 shell?.addEventListener('oilstation:scanrequest',()=>{
  if(!pump)return;
  const firstVisit=!opened.has('pump');
  if(firstVisit)pendingMobileScan=true;
  const tab=root.querySelector('.ws-sidebar [data-ws-go="pump"]');
  tab?.click();
  if(!firstVisit){
   document.getElementById('station-pump-workspace')
     ?.querySelector('#start-camera')?.click();
  }
 });
 wireWorkspaceNavigation(root);
 const newOwner=sessionStorage.getItem('oilstation_open_plan_after_invite')==='1';
 if(newOwner)sessionStorage.removeItem('oilstation_open_plan_after_invite');
 const requested=newOwner?'plan':sessionStorage.getItem('oilstation_last_workspace');
 const allowed=[...root.querySelectorAll('.ws-nav[data-ws-go]')]
   .find(button=>button.dataset.wsGo===requested);
 if(allowed)allowed.click();else mountScreen('overview');
 document.getElementById('logout').addEventListener('click',async()=>{
  sessionStorage.removeItem('oilstation_last_workspace');
  await authClient.auth.signOut();location.replace('/');
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
async function invitedEmailVerification(accessToken,invite) {
  show('<div class="mark" aria-hidden="true">O</div>'+
   '<h1>ยืนยันอีเมลผู้รับคำเชิญ</h1>'+
   '<p class="lead">อีเมลบัญชีที่เข้าสู่ระบบไม่ตรงกับอีเมลในคำเชิญ</p>'+
   '<section class="panel"><p>คุณสามารถขอรหัส 8 หลักไปยังอีเมลที่ได้รับคำเชิญ '+
   'รหัสมีอายุ 10 นาที และใช้ได้เฉพาะกับบัญชีที่เข้าสู่ระบบนี้</p>'+
   '<button class="button secondary" id="invite-send-code" type="button">ส่งรหัสยืนยันทางอีเมล</button>'+
   '<form class="coupon-form" id="invite-code-form" hidden>'+
   '<label class="field">รหัสยืนยัน 8 หลัก<input id="invite-code" '+
   'inputmode="numeric" autocomplete="one-time-code" maxlength="8" pattern="[0-9]{8}" required></label>'+
   '<button class="button primary" type="submit">ยืนยันอีเมลและรับคำเชิญ</button></form>'+
   '<button class="button secondary" id="invite-switch-account" type="button">สลับบัญชีผู้เข้าสู่ระบบ</button>'+
   '<p role="status" id="invite-verify-notice" class="notice" hidden></p></section>');
  const $=id=>document.getElementById(id);
  const notify=(message,error=false)=>{
   const target=$('invite-verify-notice');
   target.hidden=false;target.dataset.tone=error?'error':'neutral';
   target.textContent=message;
  };
  $('invite-send-code').addEventListener('click',async()=>{
   const btn=$('invite-send-code');btn.disabled=true;
   notify('กำลังส่งรหัสไปยังอีเมลที่ได้รับคำเชิญ…');
   try{
    const res=await getApi('/api/invitations/email-challenge',accessToken,{
     method:'POST',body:JSON.stringify({token:invite}),
    });
    if(!res.ok||res.data.providerAccepted!==true)
     return notify(res.status===429?'ส่งรหัสถี่เกินไป กรุณาลองอีกครั้งภายหลัง':
      'ยังส่งรหัสไม่ได้ โปรดใช้บัญชีที่มีอีเมลตรงกับคำเชิญ หรือแจ้งผู้ดูแล',true);
    $('invite-code-form').hidden=false;
    notify('ผู้ให้บริการรับคำขอส่งรหัสแล้ว โปรดตรวจอีเมลที่ได้รับคำเชิญ');
   }catch{notify('ไม่สามารถยืนยันสถานะการส่งรหัสได้ กรุณาตรวจสอบกับผู้ดูแล',true);}
   finally{btn.disabled=false;}
  });
  $('invite-code-form').addEventListener('submit',async event=>{
   event.preventDefault();
   const code=$('invite-code').value.trim();
   if(!/^[0-9]{8}$/.test(code))return notify('กรุณากรอกรหัส 8 หลัก',true);
   const btn=event.currentTarget.querySelector('button[type="submit"]');
   btn.disabled=true;
   try{
    const res=await getApi('/api/invitations/email-confirm',accessToken,{
     method:'POST',body:JSON.stringify({token:invite,code}),
    });
    if(!res.ok||res.data.accepted!==true)
     return notify('รหัสไม่ถูกต้อง หมดอายุ หรือคำเชิญถูกใช้แล้ว',true);
    sessionStorage.removeItem(INVITE_KEY);
    sessionStorage.setItem('oilstation_open_plan_after_invite','1');
    history.replaceState(null,'','/');
    location.replace('/');
   }catch{notify('เชื่อมต่อไม่ได้ กรุณาลองใหม่ก่อนรหัสหมดอายุ',true);}
   finally{btn.disabled=false;}
  });
  $('invite-switch-account').addEventListener('click',async()=>{
   await authClient.auth.signOut();
   location.reload();
  });
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
      if (accepted.data.error === 'invited_email_verification_required')
        return invitedEmailVerification(session.access_token,invite);
      guestView(true);
      return message(responseError(accepted.data),'error');
    }
    sessionStorage.removeItem(INVITE_KEY);
    sessionStorage.setItem('oilstation_open_plan_after_invite','1');
    history.replaceState(null,'','/');
  }
  const result = await getApi('/api/me',session.access_token);
  if (result.ok) return dashboard(result.data,session,cfg);
  if (result.status===403) {
    await authClient.auth.signOut();
    return guestView(false);
  }
  return showError('ไม่สามารถโหลดสิทธิ์ผู้ใช้ได้');
}
boot().catch(() => showError('ไม่สามารถเชื่อมต่อระบบได้'));
