// Live, scoped fuel history. Never use coupon reservations as completed fills.
const el=(tag,cls,content)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(content!==undefined)e.textContent=content;
 return e;
};
const money=value=>{
 const v=/^\d{1,20}$/.test(String(value))?BigInt(value):0n;
 return (v/100n).toLocaleString('th-TH')+'.'+String(v%100n).padStart(2,'0')+' ฿';
};
const thaiDate=value=>{
 const ts=Date.parse(value||'');
 return Number.isFinite(ts)?new Date(ts).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'—';
};
export function mountFuelReport({target,token,stationId,companyId=null,companies=[]}={}){
 if(!target||!stationId)return null;
 const head=el('header','os-report-header');
 head.append(el('h3',null,'รายงานการเติมน้ำมัน'),
  el('p',null,'รายการเติมน้ำมันที่เสร็จสมบูรณ์ แยกตามบริษัทและทะเบียนรถ (สูงสุด 100 รายการล่าสุด)'));
 const filters=el('div','os-report-filters');
 const selector=el('select','os-report-select');
 if(!companyId){
  const all=el('option',null,'ทุกบริษัท');all.value='';selector.append(all);
  for(const c of companies){
   const opt=el('option',null,c.companyName);opt.value=c.companyId;
   selector.append(opt);
  }
  const label=el('label','field','บริษัทลูกค้า');label.append(selector);filters.append(label);
 }
 const plateInput=el('input','os-report-plate');
 plateInput.type='search';plateInput.maxLength=40;
 plateInput.placeholder='ทะเบียนรถ เช่น QA 1001';
 const plateLabel=el('label','field','ทะเบียนรถ');plateLabel.append(plateInput);
 const btn=el('button','button secondary','ค้นหารายงาน');btn.type='button';
 filters.append(plateLabel,btn);
 const notice=el('p','os-report-notice');notice.setAttribute('role','status');
 const sum=el('div','os-report-summary');
 const scroll=el('div','os-report-table-scroll');
 const table=el('table','os-report-table');const thead=el('thead');const tr=el('tr');
 for(const h of ['วันเวลา','บริษัท','ทะเบียนรถ','ชนิดน้ำมัน','ลิตร','ยอดสุทธิ'])tr.append(el('th',null,h));
 thead.append(tr);table.append(thead);
 const tbody=el('tbody');table.append(tbody);scroll.append(table);
 target.replaceChildren(head,filters,notice,sum,scroll);
 let current=[],mounted=true,controller=null;
 async function reload(){
  if(!mounted)return;
  controller?.abort();controller=new AbortController();
  btn.disabled=true;notice.textContent='กำลังโหลดรายงาน…';
  const qp=new URLSearchParams({stationId});
  if(companyId||selector.value)qp.set('companyId',companyId||selector.value);
  if(plateInput.value.trim())qp.set('plate',plateInput.value.trim());
  try{
   const res=await fetch('/api/fuel/report?'+qp,{
    headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal,
   });
   const data=await res.json().catch(()=>null);
   if(!res.ok||!Array.isArray(data?.rows))throw Error('report_unavailable');
   current=data.rows;tbody.replaceChildren();sum.replaceChildren();
   if(current.length===0){
    const r=el('tr');const td=el('td',null,'ยังไม่มีรายการเติมน้ำมันที่ตรงกับตัวกรอง');
    td.colSpan=6;r.append(td);tbody.append(r);
   }
   let total=0n;
   for(const x of current){
    const row=el('tr');
    for(const v of [thaiDate(x.date),x.companyName||'—',x.plate||'ไม่ระบุ',x.fuel||'—',
       Number(x.liters||0).toLocaleString('th-TH',{maximumFractionDigits:3}),
       money(x.amountSatang)])row.append(el('td',null,String(v)));
    tbody.append(row);
    if(/^\d+$/.test(String(x.amountSatang)))total+=BigInt(x.amountSatang);
   }
   sum.append(el('strong',null,current.length.toLocaleString('th-TH')+' รายการ'),
    el('span',null,'ยอดเติมสุทธิ '+money(total)));
   notice.textContent=current.length===100?'แสดง 100 รายการล่าสุด กรุณาระบุบริษัทหรือทะเบียนเพื่อกรองข้อมูล':'ข้อมูลจากรายการเติมน้ำมันที่ปิดงานแล้ว';
  }catch(error){
   if(error.name==='AbortError')return;
   notice.textContent='ไม่สามารถโหลดรายงานได้ โปรดตรวจสอบสิทธิ์หรือการเชื่อมต่อ';
   tbody.replaceChildren();sum.replaceChildren();
  }finally{btn.disabled=false;}
 }
 btn.addEventListener('click',reload);
 selector.addEventListener('change',reload);
 plateInput.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();reload();}
 });
 reload();
 return {reload,destroy:()=>{mounted=false;controller?.abort();}};
}

export function mountStationCustomerCredit({target,token,stationId,onAccounts=()=>{}}={}){
 if(!target||!stationId)return null;
 const head=el('header','os-credit-head');
 const h=el('div');h.append(el('h3',null,'เครดิตลูกค้าปั๊ม'),
   el('p',null,'ยอดพร้อมใช้หลังหักหนี้และวงเงินคูปองที่กันไว้ อ้างอิงบัญชีจริงของสถานี'));
 const refresh=el('button','button secondary','รีเฟรชยอดเครดิต');refresh.type='button';
 head.append(h,refresh);
 const notice=el('p','os-credit-notice');notice.setAttribute('role','status');
 const items=el('div','os-credit-grid');
 const help=el('p','hint','การเติมเครดิตต้องเริ่มจากบริษัทแจ้งโอนและแนบสลิป จากนั้นสถานีตรวจเงินเข้าจริงและอนุมัติที่เมนูการเงิน ไม่สามารถปรับยอดเงินโดยตรงจากหน้านี้');
 const review=el('button','button primary os-credit-review','ตรวจรายการเติมเครดิตรออนุมัติ');review.type='button';
 review.addEventListener('click',()=>{
  // Native role-scoped navigation: no privilege bypass, no direct ledger writes.
  const link=document.querySelector('[data-ws-go="finance"]');
  if(!link)return void(notice.textContent='บัญชีนี้ไม่มีสิทธิ์อนุมัติการเติมเครดิต');
  link.click();
 });
 target.replaceChildren(head,notice,items,help,review);
 let accounts=[];
 async function reload(){
  refresh.disabled=true;notice.textContent='กำลังโหลดเครดิตลูกค้าปั๊ม…';
  try{
   const res=await fetch('/api/station/customer-overview?'+new URLSearchParams({stationId}),{
    headers:{authorization:'Bearer '+token},cache:'no-store',
   });
   const body=await res.json().catch(()=>null);
   if(!res.ok||!Array.isArray(body?.accounts))throw Error('not_available');
   accounts=body.accounts;items.replaceChildren();
   if(!accounts.length)items.append(el('p','os-credit-empty','ยังไม่มีบัญชีลูกค้าบริษัทที่เชื่อมกับสถานีนี้'));
   for(const a of accounts){
    const card=el('article','os-credit-account');
    card.append(el('h4',null,a.companyName),el('p','os-credit-available',money(a.availableSatang)));
    card.append(el('small',null,'ยอดพร้อมใช้'));
    const detail=el('div','os-credit-detail');
    for(const [k,v] of [
      ['เงินเติมคงเหลือ',a.prepaidSatang],
      ['เครดิตเทอม',a.creditLimitSatang],
      ['หนี้ค้าง',a.debtSatang],
      ['กันวงเงินคูปอง',a.reservedSatang],
      ['รอตรวจสลิป',a.pendingTopupSatang],
    ]){detail.append(el('span',null,k),el('strong',null,money(v)));}
    card.append(detail);items.append(card);
   }
   notice.textContent='อัปเดตบัญชี '+accounts.length+' รายการจากฐานข้อมูล';
   onAccounts(accounts);
  }catch{
   notice.textContent='ยังโหลดข้อมูลเครดิตไม่ได้ ตรวจสิทธิ์และการเชื่อมต่ออีกครั้ง';
   items.replaceChildren();
  }finally{refresh.disabled=false;}
 }
 refresh.addEventListener('click',reload);reload();
 return {reload,getAccounts:()=>accounts};
}
