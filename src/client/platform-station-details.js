// Details belong to one specific station. Only platform_superadmin reaches
// these endpoints; Sales can still hand off initial owners from their cards.
import {normalizeStationProfile,profileTextLimits} from '../domain/station-profile.mjs';
import {makeIcon} from './icons.js';
const sections=[
 {name:'ข้อมูลปั๊มน้ำมันและที่ตั้ง',fields:[
  ['stationName','ชื่อปั๊ม / สาขา','text',true],
  ['address','ที่อยู่ปั๊มน้ำมัน','textarea'],
  ['postalCode','รหัสไปรษณีย์','text'],
  ['latitude','ละติจูด','text'],
  ['longitude','ลองจิจูด','text'],
 ]},
 {name:'ข้อมูลผู้ติดต่อประจำปั๊ม',fields:[
  ['contactName','ชื่อผู้ติดต่อ','text'],
  ['stationPhone','โทรศัพท์ปั๊ม','tel'],
  ['stationEmail','อีเมลปั๊ม','email'],
 ]},
 {name:'ข้อมูลผู้ออกใบกำกับภาษี',fields:[
  ['invoiceIssuerName','ชื่อผู้ประกอบการ / ชื่อจดทะเบียน','text'],
  ['invoiceTaxId','เลขประจำตัวผู้เสียภาษี 13 หลัก','text'],
  ['invoiceBranchCode','รหัสสาขา 5 หลัก (สำนักงานใหญ่ 00000)','text'],
  ['invoiceAddress','ที่อยู่สำหรับออกใบกำกับภาษี','textarea'],
  ['invoicePhone','โทรศัพท์ผู้ประกอบการ','tel'],
  ['invoiceEmail','อีเมลสำหรับใบกำกับภาษี','email'],
 ]},
];

const makeButton=(label,style='secondary')=>{
 const b=document.createElement('button');b.type='button';
 b.className='button '+style;b.textContent=label;return b;
};
function fieldFor(name,label,type,required=false){
 const field=document.createElement('label');field.className='field os-profile-field';
 const caption=document.createElement('span');caption.textContent=label;
 const input=type==='textarea'?document.createElement('textarea'):document.createElement('input');
 if(type!=='textarea')input.type=type;
 input.name=name;input.id='station-detail-'+name;
 input.maxLength=profileTextLimits[name];input.required=required;
 input.autocomplete='off';input.spellcheck=false;
 if(name==='invoiceTaxId')input.inputMode='numeric';
 if(name==='invoiceBranchCode'||name==='postalCode')input.inputMode='numeric';
 if(name==='latitude'||name==='longitude')input.inputMode='decimal';
 if(type==='textarea')input.rows=3;
 field.append(caption,input);return field;
}
export async function mountPlatformStationDetails({
 target,station,token,getApi,fuelEditor,onBack,onSaved,
}){
 if(!target)return;
 target.replaceChildren();target.hidden=false;
 target.dataset.stationId=station.id;
 const heading=document.createElement('div');heading.className='os-profile-page-heading';
 const back=makeButton('กลับไปรายการปั๊ม');
 back.classList.add('os-profile-back');
 back.addEventListener('click',onBack);
 const title=document.createElement('div');
 const h=document.createElement('h3');h.textContent='แก้ไขรายละเอียดปั๊ม';
 const sub=document.createElement('p');sub.textContent=station.stationName||'';
 title.append(h,sub);heading.append(back,title);target.append(heading);
 const state=document.createElement('p');state.className='os-profile-load-state';
 state.setAttribute('role','status');state.textContent='กำลังโหลดรายละเอียดของปั๊มนี้…';
 target.append(state);
 let profile;
 try{
  const res=await getApi('/api/platform/station-profile?'+new URLSearchParams({stationId:station.id}),token);
  if(!res.ok||!res.data?.profile||res.data.profile.stationId!==station.id)throw Error('not_available');
  profile=res.data.profile;
 }catch{
  state.textContent='ไม่สามารถอ่านรายละเอียดปั๊มได้ กรุณากลับไปแล้วลองอีกครั้ง';
  state.dataset.tone='error';return;
 }
 if(!target.isConnected||target.dataset.stationId!==station.id)return;
 state.remove();
 const facts=document.createElement('div');facts.className='os-profile-facts';
 for(const [label,value] of [
  ['องค์กรเจ้าของ',profile.organizationName],['แบรนด์',profile.brandName],
  ['เขตเวลา',profile.timezone]]){
  const item=document.createElement('div');const small=document.createElement('small');
  small.textContent=label;const strong=document.createElement('strong');
  strong.textContent=value||'—';item.append(small,strong);facts.append(item);
 }
 const note=document.createElement('p');note.className='os-profile-readonly-note';
 note.textContent='องค์กรและแบรนด์เป็นข้อมูลที่ผูกกับระบบน้ำมันและสิทธิ์ผู้ใช้งาน หากต้องการเปลี่ยนต้องผ่านกระบวนการย้ายข้อมูล ไม่แก้ตรงนี้';
 target.append(facts,note);
 const form=document.createElement('form');form.className='os-station-profile-form';
 form.noValidate=false;
 for(const section of sections){
  const block=document.createElement('section');
  block.className='os-profile-section';
  const header=document.createElement('div');header.className='os-profile-section-head';
  const heading=document.createElement('h4');heading.textContent=section.name;header.append(heading);
  const fields=document.createElement('div');fields.className='os-profile-form-grid';
  for(const [name,label,type,required] of section.fields){
   const node=fieldFor(name,label,type,required);
   node.querySelector('[name]').value=String(profile[name]??'');
   if(type==='textarea')node.classList.add('os-profile-wide');
   fields.append(node);
  }
  if(section.name==='ข้อมูลผู้ออกใบกำกับภาษี'){
   const vat=document.createElement('label');
   vat.className='os-profile-vat';const checkbox=document.createElement('input');
   checkbox.name='vatRegistered';checkbox.type='checkbox';
   checkbox.checked=profile.vatRegistered===true;
   const text=document.createElement('span');
   text.textContent='จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)';
   vat.append(checkbox,text);fields.prepend(vat);
   const taxNote=document.createElement('p');
   taxNote.className='os-profile-tax-note os-profile-wide';
   taxNote.textContent='ข้อมูลนี้เป็นข้อมูลผู้ออกใบกำกับภาษีของปั๊ม ไม่ใช่การออกใบกำกับภาษีอัตโนมัติ หากระบุว่าจด VAT ต้องกรอกชื่อผู้ประกอบการ เลขภาษี รหัสสาขา และที่อยู่ให้ครบ';
   fields.append(taxNote);
  }
  block.append(header,fields);form.append(block);
 }
 const footer=document.createElement('div');footer.className='os-profile-save-bar';
 const submit=document.createElement('button');submit.type='submit';
 submit.className='button primary';submit.textContent='บันทึกรายละเอียดปั๊ม';
 const feedback=document.createElement('p');feedback.setAttribute('role','status');
 feedback.setAttribute('aria-live','polite');feedback.className='os-profile-save-status';
 footer.append(submit,feedback);form.append(footer);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  const values={};
  for(const name of Object.keys(profileTextLimits))
   values[name]=String(form.elements.namedItem(name)?.value??'');
  values.vatRegistered=form.elements.namedItem('vatRegistered').checked;
  const details=normalizeStationProfile(values);
  if(!details){
   feedback.textContent='ตรวจสอบชื่อปั๊ม อีเมล พิกัด เลขภาษี 13 หลัก และรหัสสาขา 5 หลัก';
   feedback.dataset.tone='error';return;
  }
  submit.disabled=true;feedback.dataset.tone='neutral';
  feedback.textContent='กำลังบันทึกข้อมูลปั๊ม…';
  try{
   const r=await getApi('/api/platform/station-profile/update',token,{
    method:'POST',body:JSON.stringify({stationId:station.id,details}),
   });
   if(!r.ok||r.data?.profile?.stationId!==station.id)throw Error('save_failed');
   profile=r.data.profile;sub.textContent=profile.stationName;
   feedback.textContent='บันทึกรายละเอียดของปั๊มนี้แล้ว';
   feedback.dataset.tone='success';
   onSaved?.(profile);
  }catch{
   feedback.textContent='บันทึกไม่สำเร็จ ไม่ได้แก้ไขข้อมูลเดิม กรุณาลองอีกครั้ง';
   feedback.dataset.tone='error';
  }finally{submit.disabled=false;}
 });
 target.append(form);
 const fuel=document.createElement('section');fuel.className='os-profile-section os-profile-fuel';
 const fuelHeader=document.createElement('div');fuelHeader.className='os-profile-section-head';
 const fuelTitle=document.createElement('h4');fuelTitle.textContent='ชนิดและราคาน้ำมันของปั๊มนี้';
 const fuelScope=document.createElement('p');fuelScope.textContent='ปั๊ม: '+profile.stationName;
 fuelHeader.append(fuelTitle,fuelScope);fuel.append(fuelHeader);
 const fuelBody=document.createElement('div');fuelBody.className='os-profile-fuel-body';
 fuel.append(fuelBody);target.append(fuel);
 try{await fuelEditor(token,station.id,fuelBody);}
 catch{
  const alert=document.createElement('p');alert.setAttribute('role','alert');
  alert.textContent='ยังโหลดราคาน้ำมันของปั๊มนี้ไม่ได้';
  fuelBody.append(alert);
 }
}
