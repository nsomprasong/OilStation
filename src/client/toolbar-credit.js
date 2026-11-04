// This header reads existing scoped balances; it never adds independent wallets.
const stationRoles=new Set(['station_owner','owner','manager','finance_manager','cashier']);
const satang=/^(?:0|[1-9][0-9]{0,15})$/;
export function toolbarCreditScope(memberships=[]){
 const companies=[...new Set(memberships.filter(m=>m.scopeType==='corporate_company'&&m.role!=='driver'&&m.corporateCompanyId).map(m=>m.corporateCompanyId))];
 if(companies.length)return {kind:'corporate',ids:companies};
 const stations=[...new Set(memberships.filter(m=>m.scopeType==='station'&&stationRoles.has(m.role)&&m.stationId).map(m=>m.stationId))];
 if(stations.length)return {kind:'station',ids:stations};
 if(memberships.length&&memberships.every(m=>m.scopeType==='corporate_company'&&m.role==='driver'))return {kind:'driver',ids:[]};
 return {kind:'unlinked',ids:[]};
}
export function formatCreditSatang(value){
 if(!satang.test(String(value)))return '—';
 const n=BigInt(value);
 return '฿'+(n/100n).toLocaleString('th-TH')+'.'+(n%100n).toString().padStart(2,'0');
}
export function mountToolbarCredit({target,token,memberships=[],shell}={}){
 if(!target)return;
 const scope=toolbarCreditScope(memberships);
 if(scope.kind==='driver'){target.hidden=true;return;}
 target.hidden=false;target.replaceChildren();
 target.setAttribute('aria-label','วงเงินคงเหลือตามบัญชีที่ได้รับสิทธิ์');
 const copy=document.createElement('span');copy.className='os-toolbar-credit-copy';
 const label=document.createElement('span');label.className='os-toolbar-credit-label';
 label.textContent=scope.kind==='station'?'วงเงินลูกค้าคงเหลือ':'วงเงินคงเหลือ';
 const amount=document.createElement('strong');amount.className='os-toolbar-credit-amount';
 amount.textContent=scope.kind==='unlinked'?'ไม่มีวงเงินที่ผูกไว้':'กำลังโหลด…';
 copy.append(label,amount);
 const select=document.createElement('select');select.className='os-toolbar-credit-select';select.hidden=true;
 select.setAttribute('aria-label','เลือกบัญชีวงเงินที่ต้องการแสดง');
 const refresh=document.createElement('button');refresh.type='button';refresh.className='os-toolbar-credit-refresh';
 refresh.textContent='↻';refresh.title='รีเฟรชวงเงินคงเหลือ';refresh.setAttribute('aria-label','รีเฟรชวงเงินคงเหลือ');
 const inner=document.createElement('div');inner.className='os-toolbar-credit-items';inner.append(copy,select,refresh);target.append(inner);
 if(scope.kind==='unlinked'){refresh.hidden=true;return;}
 let accounts=[],loadedAt=0,busy=false;
 const showSelected=()=>{
  const a=accounts.find(a=>a.id===select.value)||accounts[0];
  amount.textContent=a?formatCreditSatang(a.availableSatang):'ยังไม่มีบัญชีวงเงิน';
  copy.title=a?a.label:'ยังไม่มีบัญชีวงเงินที่ได้รับสิทธิ์';
 };
 select.addEventListener('change',showSelected);
 const api=async path=>{
  const res=await fetch(path,{headers:{authorization:'Bearer '+token},cache:'no-store'});
  const body=await res.json().catch(()=>null);
  if(!res.ok||!Array.isArray(body?.accounts))throw Error('credit_unavailable');
  return body.accounts;
 };
 const load=async()=>{
  if(busy)return;
  busy=true;refresh.disabled=true;
  if(!loadedAt)amount.textContent='กำลังโหลด…';
  const previous=select.value;
  try{
   if(scope.kind==='corporate'){
    const rows=await api('/api/my-accounts');
    accounts=rows.filter(a=>scope.ids.includes(a.companyId)).map(a=>({
     id:String(a.id),label:[a.companyName,a.stationName].filter(Boolean).join(' · '),availableSatang:a.availableSatang,
    }));
   }else{
    const results=await Promise.all(scope.ids.map(async stationId=>{
     const rows=await api('/api/station/customer-overview?'+new URLSearchParams({stationId}));
     return rows.map(a=>({id:String(a.accountId),label:a.companyName||'ลูกค้าบริษัท',availableSatang:a.availableSatang}));
    }));
    accounts=results.flat();
   }
   select.replaceChildren();
   for(const account of accounts){
    const option=document.createElement('option');option.value=account.id;option.textContent=account.label;select.append(option);
   }
   select.hidden=accounts.length<2;
   if(accounts.some(a=>a.id===previous))select.value=previous;
   showSelected();loadedAt=Date.now();
  }catch{
   accounts=[];select.hidden=true;select.replaceChildren();
   amount.textContent='ตรวจสอบยอดไม่ได้';copy.title='ไม่สามารถอ่านวงเงินจากระบบได้ กรุณารีเฟรช';
  }finally{busy=false;refresh.disabled=false;}
 };
 refresh.addEventListener('click',load);
 shell?.addEventListener('oilstation:screenchange',()=>{if(Date.now()-loadedAt>30000)void load();});
 void load();
}
