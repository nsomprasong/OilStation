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
export function mountQaAccountsAdmin({target,token}){
 if(!target)return;
 target.replaceChildren();
 const box=el('section',null,'os-qa-admin');
 const details=el('details');
 details.append(el('summary','บัญชีทดสอบ (เฉพาะผู้ดูแลระบบ)'));
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
 for(const [key,name] of Object.entries({platform:'Platform',organization:'เจ้าของกิจการ',
   station:'ปั๊ม',corporate_company:'บริษัทลูกค้า'}))scopeType.append(option(key,name));
 const role=el('select');role.required=true;role.id='qa-create-role';
 const scope=el('select');scope.required=true;scope.id='qa-create-scope';
 const label=(name,node)=>{
  const lbl=el('label',name);lbl.append(node);return lbl;
 };
 const send=el('button','สร้างบัญชีทดสอบ','button primary');send.type='submit';
 form.append(label('ชื่อบัญชีทดสอบ',username),label('รหัสผ่านทดสอบ',password),
  label('ประเภทสิทธิ์',scopeType),label('บทบาท',role),
  label('พื้นที่ที่อนุญาต',scope),send);
 const note=el('p','QA ต้องกำหนดSales 2 คน คนละ 2 ปั๊ม (รวม 4 ปั๊ม) และลูกค้าปั๊มละ 3 ราย (รวม 12 บัญชี)ไว้ในสิทธิ์ฝั่งเซิร์ฟเวอร์ก่อนสร้างผู้ใช้ที่เกี่ยวข้อง','os-qa-note');
 details.append(explain,form,note,status);box.append(details);target.append(box);
 let scopes={};
 const refresh=()=>{
  const kind=scopeType.value;
  role.replaceChildren(...(roles[kind]||[]).map(([value,name])=>option(value,name)));
  scope.replaceChildren();
  for(const entry of scopes[kind]||[])scope.append(option(entry.id||'',entry.name));
  scope.disabled=!(scopes[kind]||[]).length;
  send.disabled=scope.disabled;
  if(scope.disabled)status.textContent='ยังไม่ได้กำหนดรายการ '+kind+' ในขอบเขต QA ที่อนุมัติ';
 };
 scopeType.addEventListener('change',refresh);
 fetch('/api/qa/scopes',{headers:{authorization:'Bearer '+token},cache:'no-store'})
  .then(async res=>{
   if(!res.ok)throw new Error('qa_not_ready');
   const data=await res.json();scopes=data.scopes||{};
   status.textContent='ชุดทดสอบ: '+data.runId+' · ไม่มีการลบข้อมูลอัตโนมัติ';
   refresh();
  }).catch(()=>{status.textContent='ยังเปิดโหมด QA ไม่สำเร็จ หรือไม่มีสิทธิ์จัดการบัญชี';
   send.disabled=true;});
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
   if(!result.ok)throw new Error('qa_create_failed');
   const data=await result.json();
   status.textContent='สร้างบัญชี '+data.account.alias+' สำเร็จ ('+data.account.roleCode+
    ') ออกจากระบบแล้วใช้ชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้ได้ทันที';
   username.value='';password.value='';
  }catch{status.textContent='สร้างบัญชีไม่สำเร็จ ตรวจสอบสิทธิ์ ชื่อที่ซ้ำ หรือขอบเขตที่อนุมัติ';}
  finally{send.disabled=scope.disabled;}
 });
}
