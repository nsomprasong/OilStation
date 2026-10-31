/** Accessible Plan CRUD workspace. The Worker is authoritative for all writes. */
const el=(tag,value)=>{const element=document.createElement(tag);if(value!==undefined)element.textContent=value;return element;};
const makeButton=(text,kind='secondary')=>{const b=el('button',text);b.type='button';b.className='button '+kind;return b;};
const baht=satang=>{
 if(!/^(?:0|[1-9]\d{0,15})$/.test(String(satang??'')))return '—';
 const n=BigInt(satang);return (n/100n).toLocaleString('th-TH')+'.'+String(n%100n).padStart(2,'0')+' บาท';
};
const moneyToSatang=value=>{
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value))return null;
 const [whole,dec='']=value.split('.');
 return (BigInt(whole)*100n+BigInt(dec.padEnd(2,'0'))).toString();
};
const satangInput=v=>{
 if(!/^(?:0|[1-9]\d{0,15})$/.test(String(v??'')))return '';
 const n=BigInt(v);return String(n/100n)+'.'+String(n%100n).padStart(2,'0');
};
export function validatePlanDraft(input){
 const name=String(input.name??'').trim();
 const code=String(input.code??'').trim().toLowerCase();
 const couponPriceSatang=moneyToSatang(String(input.couponBaht??'').trim());
 const hrPriceSatang=moneyToSatang(String(input.hrBaht??'').trim());
 const bundlePriceSatang=moneyToSatang(String(input.bundleBaht??'').trim());
 if(name.length<3||name.length>120)return {field:'name',error:'กรุณาตั้งชื่อแพ็กเกจอย่างน้อย 3 ตัวอักษร (ไม่เกิน 120)'};
 if(!/^[a-z][a-z0-9_-]{2,39}$/.test(code))return {field:'code',error:'รหัสแพ็กเกจต้องเป็นภาษาอังกฤษตัวเล็ก 3–40 ตัว เริ่มด้วยตัวอักษร'};
 if(!['monthly','yearly'].includes(input.frequency))return {field:'frequency',error:'กรุณาเลือกรอบชำระเงิน'};
 if([couponPriceSatang,hrPriceSatang,bundlePriceSatang].some(v=>v===null))
  return {field:['couponBaht','hrBaht','bundleBaht'][[couponPriceSatang,hrPriceSatang,bundlePriceSatang].findIndex(v=>v===null)],error:'ระบุราคาทั้ง 3 ช่องเป็นตัวเลขบาท ไม่ใส่เครื่องหมายคอมมา และทศนิยมไม่เกิน 2 ตำแหน่ง'};
 if(BigInt(couponPriceSatang)>99999999n||BigInt(hrPriceSatang)>99999999n||
  BigInt(bundlePriceSatang)<1000n||BigInt(bundlePriceSatang)>99999999n||
  BigInt(couponPriceSatang)+BigInt(hrPriceSatang)<1000n)
  return {field:'bundleBaht',error:'ราคารวมอย่างน้อย 10 บาท และราคาแต่ละรายการต้องไม่เกิน 999,999.99 บาท'};
 const effectiveOn=String(input.effectiveOn??'');
 const date=new Date(effectiveOn+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn)||Number.isNaN(date.valueOf())||
  date.toISOString().slice(0,10)!==effectiveOn||effectiveOn<'2025-01-01')
  return {field:'effectiveOn',error:'กรุณาเลือกวันที่เริ่มใช้ราคาที่ถูกต้อง'};
 return {body:{name,code,frequency:input.frequency,
  couponPriceSatang,hrPriceSatang,bundlePriceSatang,effectiveOn}};
}
const errorFor=code=>({
 plan_in_use:'แพ็กเกจนี้เคยถูกเลือกหรือใช้งานแล้ว ไม่สามารถแก้ไขหรือนำออกได้ เพื่อรักษาประวัติการเงิน',
 billing_configuration_unavailable:'บันทึกไม่สำเร็จ ตรวจรหัสแพ็กเกจที่อาจซ้ำ ชื่อ ราคา และวันที่เริ่มใช้',
 permission_denied:'บัญชีนี้ไม่มีสิทธิ์จัดการแพ็กเกจ',
 invalid_platform_billing:'ข้อมูลไม่ถูกต้อง กรุณาตรวจทุกช่องอีกครั้ง',
}[code]||'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง');
const dateToday=()=>{
 const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const newCode=()=>('plan_'+Date.now().toString(36)).slice(0,40);
function inputField(title,name,{placeholder='',type='text',required=true}={}){
 const wrap=el('label',title);wrap.className='field';
 const input=el('input');input.name=name;input.type=type;input.required=required;
 if(placeholder)input.placeholder=placeholder;
 if(name.endsWith('Baht')){input.inputMode='decimal';input.autocomplete='off';}
 wrap.append(input);return wrap;
}
function toggleStatus(node,message,tone=''){
 node.textContent=message;node.dataset.tone=tone;
}
export function mountSaasPlanManager({root,rpc}){
 const section=el('section');section.className='os-plan-manager saas-existing-plans saas-simple-card';
 const heading=el('div');heading.className='os-plan-manager-header';
 const headingCopy=el('div');headingCopy.append(el('h3','แพ็กเกจสำหรับปั๊มน้ำมัน'),el('p','ดูราคาและจัดการแพ็กเกจทั้งหมดได้จากที่เดียว'));
 const actions=el('div');actions.className='os-plan-toolbar';
 const search=inputField('ค้นหาแพ็กเกจ','search',{type:'search',required:false,placeholder:'ค้นหาชื่อหรือรหัส'});
 search.className='os-plan-search';const searchBox=search.querySelector('input');searchBox.setAttribute('aria-label','ค้นหาแพ็กเกจ');
 const refresh=makeButton('รีเฟรช');refresh.classList.add('os-plan-refresh');
 const add=makeButton('+ เพิ่มแพ็กเกจ','primary');
 actions.append(search,refresh,add);heading.append(headingCopy,actions);
 const list=el('div');list.className='saas-plan-list';
 const listStatus=el('p');listStatus.className='saas-simple-status';listStatus.setAttribute('role','status');
 section.append(heading,listStatus,list);
 const form=el('form');form.id='os-plan-editor';form.className='coupon-form saas-simple-card os-plan-editor';
 form.hidden=true;
 const formHead=el('div');formHead.className='os-plan-form-head';
 const formTitle=el('h3','เพิ่มแพ็กเกจใหม่');const hint=el('p','กรอกข้อมูลพื้นฐานและราคาทั้ง 3 แบบ แล้วตรวจสอบก่อนบันทึก');
 formHead.append(formTitle,hint);form.append(formHead);
 const basics=el('fieldset');basics.className='os-plan-section';
 basics.append(el('legend','1 · ข้อมูลแพ็กเกจ'));
 const baseGrid=el('div');baseGrid.className='os-plan-basics';
 baseGrid.append(inputField('ชื่อแพ็กเกจ','name',{placeholder:'เช่น Standard รายเดือน'}));
 const cadence=el('label','รอบชำระเงิน');cadence.className='field';const freq=el('select');freq.name='frequency';freq.required=true;
 for(const [value,label] of [['monthly','รายเดือน'],['yearly','รายปี']]){const o=el('option',label);o.value=value;freq.append(o);}
 cadence.append(freq);baseGrid.append(cadence);
 const day=inputField('วันที่เริ่มใช้ราคา','effectiveOn',{type:'date'});day.querySelector('input').min='2025-01-01';baseGrid.append(day);
 basics.append(baseGrid);
 const extra=el('details');extra.className='os-plan-advanced';
 const summary=el('summary','ตั้งค่าขั้นสูง · รหัสแพ็กเกจ');extra.append(summary,
 inputField('รหัสอ้างอิงภายในระบบ','code',{placeholder:'สร้างให้อัตโนมัติ'}));
 extra.append(el('p','ระบบสร้างรหัสใหม่ให้อัตโนมัติ ต้องไม่ซ้ำกับแพ็กเกจอื่น และไม่ควรเปลี่ยนถ้าไม่จำเป็น'));
 basics.append(extra);
 const priceSection=el('fieldset');priceSection.className='os-plan-section';
 priceSection.append(el('legend','2 · ราคาเป็นบาทต่อปั๊ม / ต่อรอบบิล'));
 const prices=el('div');prices.className='os-price-grid';
 prices.append(inputField('QR Coupon (บาท)','couponBaht',{placeholder:'เช่น 1600.00'}),
 inputField('HR & Payroll (บาท)','hrBaht',{placeholder:'เช่น 1600.00'}),
 inputField('ใช้ทั้ง 2 บริการ (บาท)','bundleBaht',{placeholder:'เช่น 2500.00'}));
 priceSection.append(prices,el('p','ราคาแพ็กคู่เป็นราคาสุทธิของบริการทั้งสอง ไม่ได้นำสองราคาด้านบนมาบวกซ้ำ'));
 const livePreview=el('div');livePreview.className='os-plan-price-review';livePreview.setAttribute('aria-live','polite');
 priceSection.append(livePreview);
 const actionsFooter=el('div');actionsFooter.className='os-plan-form-actions';
 const cancel=makeButton('ยกเลิก');const save=el('button','บันทึกแพ็กเกจ');save.type='submit';save.className='button primary';
 actionsFooter.append(cancel,save);
 const formStatus=el('p');formStatus.setAttribute('role','status');formStatus.className='saas-simple-status';
 form.append(basics,priceSection,actionsFooter,formStatus);
 const dialog=el('dialog');dialog.className='os-plan-confirm';dialog.setAttribute('aria-labelledby','os-plan-confirm-title');
 const dialogTitle=el('h3','นำแพ็กเกจออกจากรายการ');dialogTitle.id='os-plan-confirm-title';
 const dialogText=el('p');const dialogStatus=el('p');dialogStatus.className='saas-simple-status';dialogStatus.setAttribute('role','status');
 const dialogButtons=el('div');dialogButtons.className='os-plan-form-actions';
 const dialogCancel=makeButton('ยกเลิก');const dialogOK=makeButton('นำออกจากรายการ','primary');
 dialogButtons.append(dialogCancel,dialogOK);dialog.append(dialogTitle,dialogText,dialogStatus,dialogButtons);
 root.append(section,form,dialog);
 const controls=name=>form.elements.namedItem(name);
 let plans=[],editingId=null,loading=false,busy=false;
 const preview=()=>{
  const c=moneyToSatang(controls('couponBaht').value),h=moneyToSatang(controls('hrBaht').value),
   b=moneyToSatang(controls('bundleBaht').value);
  livePreview.replaceChildren();
  livePreview.append(el('strong','ตรวจสอบราคาก่อนบันทึก · '+(freq.value==='yearly'?'รายปี':'รายเดือน')));
  if([c,h,b].some(v=>v===null)){livePreview.append(el('p','กรอกครบทั้ง 3 ราคาเพื่อดูสรุป'));return;}
  const line=el('div');line.className='os-plan-preview-values';
  line.append(el('span','QR '+baht(c)),el('span','HR '+baht(h)),el('strong','แพ็กคู่ '+baht(b)));
  livePreview.append(line);
  const reduction=BigInt(c)+BigInt(h)-BigInt(b);
  if(reduction>0n)livePreview.append(el('small','แพ็กคู่ประหยัด '+baht(reduction)+' เมื่อเทียบกับซื้อแยก'));
  if(reduction<0n)livePreview.append(el('small','ตรวจสอบราคาแพ็กคู่: สูงกว่าซื้อแยก '+baht(-reduction)));
 };
 const openEditor=()=>{
  form.hidden=false;
  form.dispatchEvent(new Event('os:create-show'));
  form.scrollIntoView?.({block:'start',behavior:'smooth'});
  controls('name').focus();
 };
 const closeEditor=()=>{
  form.dispatchEvent(new Event('os:create-hide'));
  form.hidden=true;editingId=null;toggleStatus(formStatus,'');
 };
 const prepareCreate=()=>{
  editingId=null;form.reset();extra.open=false;
  controls('code').value=newCode();controls('effectiveOn').value=dateToday();
  formTitle.textContent='เพิ่มแพ็กเกจใหม่';save.textContent='บันทึกแพ็กเกจ';
  hint.textContent='ระบุชื่อ รอบชำระ และราคาที่ลูกค้าจะเห็น ไม่จำเป็นต้องตั้งรหัสเอง';
  toggleStatus(formStatus,'');preview();
 };
 const getForm=()=>Object.fromEntries(new FormData(form));
 const fillForm=detail=>{
  for(const key of ['name','code','frequency','effectiveOn'])controls(key).value=String(detail[key]??'');
  controls('couponBaht').value=satangInput(detail.couponPriceSatang);
  controls('hrBaht').value=satangInput(detail.hrPriceSatang);
  controls('bundleBaht').value=satangInput(detail.bundlePriceSatang);preview();
 };
 const startCreate=()=>{prepareCreate();openEditor();};
 form.addEventListener('os:prepare-create',prepareCreate);
 add.addEventListener('click',startCreate);
 cancel.addEventListener('click',()=>{closeEditor();add.focus();});
 for(const input of form.querySelectorAll('input,select'))input.addEventListener('input',preview);
 const findRule=(p,module,method='flat')=>(p.rules||[]).find(r=>r.moduleCode===module&&r.billingMethod===method)?.priceSatang;
 const paint=()=>{
  list.replaceChildren();
  const query=searchBox.value.trim().toLocaleLowerCase('th-TH');
  const shown=plans.filter(p=>(p.name+' '+p.code).toLocaleLowerCase('th-TH').includes(query));
  if(!shown.length){const empty=el('div');empty.className='os-plan-empty';
   empty.append(el('strong',plans.length?'ไม่พบแพ็กเกจที่ค้นหา':'ยังไม่มีแพ็กเกจ'),
    el('p',plans.length?'ลองใช้ชื่อหรือรหัสอื่น':'เริ่มสร้างแพ็กเกจแรก เพื่อให้เจ้าของปั๊มเลือกใช้'));
   if(!plans.length){const start=makeButton('+ สร้างแพ็กเกจแรก','primary');start.addEventListener('click',startCreate);empty.append(start);}
   list.append(empty);return;}
  for(const p of shown){
   const card=el('article');card.className='saas-plan-row os-plan-card';card.dataset.planId=p.id;
   const identity=el('div');identity.className='saas-plan-meta';
   const nameRow=el('div');nameRow.className='os-plan-name-row';
   nameRow.append(el('strong',p.name),el('span','อยู่ในรายการ'));
   identity.append(nameRow,el('small',p.code+' · '+(p.frequency==='yearly'?'เรียกเก็บรายปี':'เรียกเก็บรายเดือน')));
   const amounts=el('div');amounts.className='saas-plan-prices';
   amounts.append(el('span','QR Coupon · '+baht(findRule(p,'qr_coupon'))),
    el('span','HR & Payroll · '+baht(findRule(p,'hr_payroll'))),
    el('strong','แพ็กคู่ · '+baht(findRule(p,null,'bundle')??(BigInt(findRule(p,'qr_coupon')??'0')+BigInt(findRule(p,'hr_payroll')??'0')).toString())));
   const rowActions=el('div');rowActions.className='os-plan-row-actions';
   const edit=makeButton('แก้ไข');edit.setAttribute('aria-label','แก้ไขแพ็กเกจ '+p.name);
   const remove=makeButton('นำออกจากรายการ');remove.classList.add('saas-plan-delete');remove.setAttribute('aria-label','นำแพ็กเกจ '+p.name+' ออกจากรายการ');
   rowActions.append(edit,remove);
   edit.addEventListener('click',async()=>{
    if(busy)return;edit.disabled=true;toggleStatus(listStatus,'กำลังเปิดข้อมูลสำหรับแก้ไข…');
    try{
     const detail=await rpc('plan-editor?planId='+encodeURIComponent(p.id));
     prepareCreate();fillForm(detail);
     if(detail.canEdit!==true){
      editingId=null;controls('code').value=newCode();
      controls('name').value=String(detail.name)+' (ใหม่)';
      formTitle.textContent='คัดลอกเป็นแพ็กเกจใหม่';
      hint.textContent='แพ็กเกจนี้มีประวัติการใช้งาน ไม่สามารถแก้ราคาย้อนหลังได้ ระบบจึงเตรียมสำเนาใหม่ให้';
      save.textContent='สร้างแพ็กเกจใหม่';toggleStatus(formStatus,'ราคาเดิมของลูกค้าจะไม่ถูกเปลี่ยน','warning');
     }else{
      editingId=p.id;formTitle.textContent='แก้ไขแพ็กเกจ';
      hint.textContent='แก้ไขได้เฉพาะแพ็กเกจที่ยังไม่เคยถูกเลือกหรือใช้ หากมีการใช้งานระหว่างนี้ ระบบจะปฏิเสธการบันทึก';
      save.textContent='บันทึกการเปลี่ยนแปลง';
     }
     openEditor();toggleStatus(listStatus,'');
    }catch(e){toggleStatus(listStatus,errorFor(e.message),'error');}
    finally{edit.disabled=false;}
   });
   remove.addEventListener('click',()=>{
    dialogText.textContent='นำ “'+p.name+'” ออกจากรายการที่เลือกได้? ประวัติเดิมจะยังอยู่ และถ้ามีลูกค้าเกี่ยวข้อง ระบบจะไม่อนุญาตให้ทำรายการนี้';
    toggleStatus(dialogStatus,'');dialogOK.disabled=false;
    dialogOK.onclick=async()=>{
     if(busy)return;busy=true;dialogOK.disabled=true;toggleStatus(dialogStatus,'กำลังตรวจสอบและนำออก…');
     try{await rpc('archive-plan',{planId:p.id});dialog.close();await load();toggleStatus(listStatus,'นำแพ็กเกจออกจากรายการแล้ว','success');}
     catch(e){toggleStatus(dialogStatus,errorFor(e.message),'error');}
     finally{busy=false;dialogOK.disabled=false;}
    };
    dialog.showModal();dialogCancel.focus();
   });
   card.append(identity,amounts,rowActions);list.append(card);
  }
 };
 async function load(){
  if(loading)return;
  loading=true;refresh.disabled=true;toggleStatus(listStatus,'กำลังโหลดรายการแพ็กเกจ…');
  try{
   const data=await rpc('overview');plans=Array.isArray(data.plans)?data.plans:[];
   paint();toggleStatus(listStatus,'ทั้งหมด '+plans.length+' แพ็กเกจ');
  }catch(e){toggleStatus(listStatus,'โหลดรายการไม่สำเร็จ กรุณากดรีเฟรช','error');}
  finally{refresh.disabled=false;loading=false;}
 }
 dialogCancel.addEventListener('click',()=>dialog.close());
 refresh.addEventListener('click',load);
 searchBox.addEventListener('input',paint);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const result=validatePlanDraft(getForm());
  if(result.error){toggleStatus(formStatus,result.error,'error');if(result.field==='code')extra.open=true;controls(result.field)?.focus();return;}
  busy=true;save.disabled=true;cancel.disabled=true;
  toggleStatus(formStatus,'กำลังบันทึกแพ็กเกจ…');
  try{
   const wasEditing=Boolean(editingId);
   await rpc(wasEditing?'edit-plan':'bundle-plan',wasEditing?{planId:editingId,...result.body}:result.body);
   closeEditor();await load();toggleStatus(listStatus,wasEditing?'บันทึกการแก้ไขแล้ว':'บันทึกแพ็กเกจใหม่เรียบร้อย','success');
   add.focus();
  }catch(error){toggleStatus(formStatus,errorFor(error.message),'error');}
  finally{busy=false;save.disabled=false;cancel.disabled=false;}
 });
 prepareCreate();
 load();
 return {form,load};
}
