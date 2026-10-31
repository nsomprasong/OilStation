// Test-mode accounts are fully authenticated Supabase users with scoped roles.
// Shown to platform Super Admin only when the Worker explicitly enables QA.
const roles={
 platform:[['platform_sales','เซลล์ (Sales)'],['platform_support','ฝ่ายสนับสนุน']],
 organization:[['organization_owner','เจ้าขององค์กร'],['billing_manager','ผู้จัดการค่าบริการ']],
 station:[['station_owner','เจ้าของปั๊ม'],['manager','ผู้จัดการปั๊ม'],
  ['cashier','แคชเชียร์'],['attendant','พนักงานเติมน้ำมัน'],
  ['pump_staff','พนักงานหน้าลาน'],['hr_manager','ผู้จัดการ HR'],
  ['finance_manager','ผู้จัดการการเงิน']],
 corporate_company:[['corporate_admin','ผู้ดูแลบริษัท'],['coupon_issuer','ผู้ออกคูปอง'],
  ['accountant','บัญชี'],['finance_manager','ผู้จัดการการเงิน'],['driver','คนขับรถ']],
};
const qaRoleSuffix={
 organization:{organization_owner:'owner',billing_manager:'billing'},
 station:{station_owner:'owner',manager:'manager',cashier:'cashier',attendant:'attendant',
  pump_staff:'pump',hr_manager:'hr',finance_manager:'finance'},
 corporate_company:{corporate_admin:'admin',coupon_issuer:'issuer',
  accountant:'accountant',finance_manager:'finance',driver:'driver'},
};
const stationCodes=['s01a','s01b','s02a','s02b'];
const el=(tag,text,cls)=>{
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=text;
 if(cls)node.className=cls;
 return node;
};
const option=(value,label)=>{
 const node=el('option',label);
 node.value=value;return node;
};
export function mountQaAccountsAdmin({target,token,salesMode=false}){
 if(!target)return;
 target.replaceChildren();
 const box=el('section',null,'os-qa-admin');
 // During QA, keep the authenticated Admin form persistently visible.
 // The native <details> collapsed during automated/keyboard interaction,
 // leaving test users unable to focus or submit the protected fields.
 const details=el('div',null,'os-qa-expanded');
 details.append(el('h3',salesMode?'สร้างบัญชีทดสอบในปั๊มของฉัน':'บัญชีทดสอบ (เฉพาะผู้ดูแลระบบ)'));
 const explain=el('p','สร้างบัญชีที่ใช้ชื่อผู้ใช้และรหัสผ่านแทนอีเมลจริง พร้อมกำหนดสิทธิ์ตามขอบเขตที่อนุมัติ ไม่มีการส่งคำเชิญหรือยืนยันอีเมล','os-qa-note');
 const status=el('p','','os-qa-status');status.setAttribute('role','status');
 const form=el('form',null,'os-qa-form');
 const username=el('input');username.id='qa-create-username';username.name='qaAlias';
 username.required=true;username.minLength=3;username.maxLength=31;username.pattern='[a-z][a-z0-9-]{2,30}';
 username.placeholder='เช่น sales01';
 const password=el('input');password.id='qa-create-password';password.type='password';
 password.required=true;password.minLength=16;password.maxLength=128;
 password.autocomplete='new-password';password.placeholder='อย่างน้อย 16 ตัว พร้อมตัวเลขและสัญลักษณ์';
 const scopeType=el('select');scopeType.required=true;scopeType.id='qa-create-scope-type';
 for(const [key,name] of Object.entries(salesMode?
  {organization:'เจ้าของกิจการ',station:'ปั๊ม'}:
  {platform:'Platform',organization:'เจ้าของกิจการ',
   station:'ปั๊ม',corporate_company:'บริษัทลูกค้า'}))scopeType.append(option(key,name));
 const role=el('select');role.required=true;role.id='qa-create-role';
 const scope=el('select');scope.required=true;scope.id='qa-create-scope';
 const label=(name,node)=>{
  const lbl=el('label',name);lbl.append(node);return lbl;
 };
 const send=el('button','สร้างบัญชีทดสอบ','button primary');send.type='submit';
 const reset=el('button','ตั้งรหัสผ่าน QA ใหม่','button secondary');reset.type='button';
 form.append(label('ชื่อบัญชีทดสอบ',username),label('รหัสผ่านทดสอบ',password),
  label('ประเภทสิทธิ์',scopeType),label('บทบาท',role),
  label('พื้นที่ที่อนุญาต',scope),send);
 if(!salesMode)form.append(reset);
 const note=el('p',salesMode?
  'สร้างบัญชีทดสอบได้เฉพาะองค์กรและปั๊มที่ตัวเองเปิดและยังรับผิดชอบ ไม่มีสิทธิ์สร้าง Sales, Support หรือบัญชีบริษัท':
  'ขอบเขตทดสอบ Sales 2 คน ปั๊มรวม 4 แห่ง บริษัท 12 ราย ข้ามบทบาท Support ตามคำสั่งเจ้าของโครงการ','os-qa-note');
 details.append(explain,form,note,status);box.append(details);target.append(box);
 let scopes={};
 const aliasForSelection=()=>{
  const kind=scopeType.value;
  if(kind==='platform')return role.value==='platform_sales'?'sales01':'support01';
  const idx=(scopes[kind]||[]).findIndex(x=>String(x.id)===scope.value);
  if(idx<0)return '';
  const prefix=(scopes[kind]||[])[idx]?.aliasPrefix||
   (kind==='organization'?'o'+String(idx+1).padStart(2,'0'):
    kind==='station'?stationCodes[idx]:'c'+String(idx+1).padStart(2,'0'));
  return prefix&&qaRoleSuffix[kind]?.[role.value]?prefix+'-'+qaRoleSuffix[kind][role.value]:'';
 };
 const suggestAlias=()=>{username.value=aliasForSelection();};
 const refresh=()=>{
  const kind=scopeType.value;
  role.replaceChildren(...(roles[kind]||[]).map(([value,name])=>option(value,name)));
  scope.replaceChildren();
  for(const entry of scopes[kind]||[]){
    const item=option(entry.id||'',entry.name);
    if(entry.aliasPrefix)item.dataset.aliasPrefix=entry.aliasPrefix;
    scope.append(item);
  }
  // Platform has no subordinate UUID: no scope selection is required.
  const available=kind==='platform'||(scopes[kind]||[]).length>0;
  scope.disabled=kind==='platform'||!available;
  scope.required=kind!=='platform';
  send.disabled=!available;
  suggestAlias();
  if(!available)status.textContent='ยังไม่ได้กำหนดรายการ '+kind+' ในขอบเขต QA ที่อนุมัติ';
 };
 scopeType.addEventListener('change',refresh);
 role.addEventListener('change',suggestAlias);
 scope.addEventListener('change',suggestAlias);
 fetch('/api/qa/scopes',{headers:{authorization:'Bearer '+token},cache:'no-store'})
  .then(async res=>{
   if(!res.ok)throw new Error('qa_not_ready');
   const data=await res.json();scopes=data.scopes||{};
   status.textContent='ชุดทดสอบ: '+data.runId+' · ไม่มีการลบข้อมูลอัตโนมัติ';
   refresh();
  }).catch(()=>{status.textContent='ยังเปิดโหมด QA ไม่สำเร็จ หรือไม่มีสิทธิ์จัดการบัญชี';
   send.disabled=true;});
 reset.addEventListener('click',async()=>{
  if(!username.checkValidity()||!password.checkValidity()){
   form.reportValidity();return;
  }
  const alias=username.value.trim().toLowerCase();
  if(!alias)return;
  reset.disabled=true;status.textContent='กำลังตั้งรหัสผ่าน QA ใหม่…';
  try{
   const response=await fetch('/api/qa/reset-password',{
    method:'POST',cache:'no-store',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({alias,password:password.value}),
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||'request_failed');
   status.textContent='ตั้งรหัสผ่านใหม่ให้ '+alias+' สำเร็จ สามารถเข้าสู่ระบบ QA ได้ทันที';
   password.value='';
  }catch(error){
   status.textContent='ตั้งรหัสผ่าน QA ไม่สำเร็จ ('+
    String(error?.message||'request_failed')+')';
  }finally{reset.disabled=false;}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(send.disabled)return;
  if(!form.reportValidity())return;
  send.disabled=true;status.textContent='กำลังสร้างบัญชีทดสอบ…';
  try{
   const result=await fetch('/api/qa/accounts',{method:'POST',cache:'no-store',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({alias:username.value.trim().toLowerCase(),password:password.value,
     scopeType:scopeType.value,scopeId:scopeType.value==='platform'?null:scope.value,
     roleCode:role.value}),
   });
   if(!result.ok){
     const failure=await result.json().catch(()=>({}));
     const reason=typeof failure.error==='string'&&/^[a-z_]{3,70}$/.test(failure.error)?
       failure.error:'request_failed';
     const error=new Error(reason);error.status=result.status;
     throw error;
   }
   const data=await result.json();
   status.textContent='สร้างบัญชี '+data.account.alias+' สำเร็จ ('+data.account.roleCode+
    ') ออกจากระบบแล้วใช้ชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้ได้ทันที';
   username.value='';password.value='';
  }catch(error){
   // Keep passwords and internal database diagnostics out of the UI while
   // surfacing a safe reason/status for a reproducible QA failure report.
   const reason=String(error?.message||'request_failed');
   status.textContent='สร้างบัญชีไม่สำเร็จ ('+reason+
    (error?.status?' HTTP '+error.status:'')+
    ') โปรดตรวจรายงานข้อผิดพลาดก่อนส่งคำขอซ้ำ';
  }
  finally{send.disabled=!(scopeType.value==='platform'||(scopes[scopeType.value]||[]).length);}
 });
}
