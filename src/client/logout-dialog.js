/** OilStation branded confirmation dialog. Never uses browser confirm/alert. */
export function renderLogoutDialog(){
 return `<dialog class="os-logout-dialog" data-logout-dialog
   aria-labelledby="os-logout-title" aria-describedby="os-logout-description">
   <div class="os-logout-dialog-body">
     <div class="os-logout-icon" aria-hidden="true"><i data-ui-icon="power"></i></div>
     <span class="os-logout-eyebrow">OILSTATION / ACCOUNT</span>
     <h2 id="os-logout-title">ออกจากระบบ?</h2>
     <p id="os-logout-description">คุณต้องการออกจาก OilStation ใช่หรือไม่? คุณสามารถเข้าสู่ระบบอีกครั้งได้ทุกเมื่อ</p>
     <p class="os-logout-feedback" data-logout-feedback role="status" aria-live="polite" hidden></p>
     <div class="os-logout-actions">
       <button class="os-logout-cancel" type="button" data-logout-cancel>ยกเลิก</button>
       <button class="os-logout-confirm" type="button" data-logout-confirm>
         <i data-ui-icon="power"></i><span>ออกจากระบบ</span>
       </button>
     </div>
   </div>
 </dialog>`;
}

export function wireLogoutDialog(root){
 const dialog=root.querySelector('[data-logout-dialog]');
 const shell=root.querySelector('[data-workspace-shell]');
 const cancel=root.querySelector('[data-logout-cancel]');
 const confirm=root.querySelector('[data-logout-confirm]');
 const feedback=root.querySelector('[data-logout-feedback]');
 if(!dialog||!shell||!cancel||!confirm||!feedback)return;
 let lastOpener=null;
 const isBusy=()=>dialog.dataset.busy==='true';
 const close=()=>{
  if(isBusy())return;
  dialog.close();
 };
 const open=button=>{
  if(dialog.open)return;
  lastOpener=button;
  feedback.hidden=true;
  feedback.textContent='';
  feedback.dataset.tone='neutral';
  dialog.dataset.busy='false';
  confirm.disabled=false;
  cancel.disabled=false;
  dialog.showModal();
  cancel.focus();
 };
 for(const button of root.querySelectorAll('[data-mobile-logout],#logout')){
  button.addEventListener('click',()=>open(button));
 }
 cancel.addEventListener('click',close);
 confirm.addEventListener('click',()=>{
  if(isBusy())return;
  dialog.dataset.busy='true';
  confirm.disabled=true;
  cancel.disabled=true;
  feedback.textContent='กำลังออกจากระบบ…';
  feedback.dataset.tone='neutral';
  feedback.hidden=false;
  shell.dispatchEvent(new CustomEvent('oilstation:logoutrequested'));
 });
 dialog.addEventListener('cancel',event=>{
  if(isBusy())event.preventDefault();
 });
 dialog.addEventListener('click',event=>{
  if(event.target===dialog)close();
 });
 dialog.addEventListener('close',()=>{
  if(!isBusy()&&lastOpener?.isConnected)lastOpener.focus();
 });
 shell.addEventListener('oilstation:logoutfailed',()=>{
  dialog.dataset.busy='false';
  confirm.disabled=false;
  cancel.disabled=false;
  feedback.textContent='ออกจากระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง';
  feedback.dataset.tone='error';
  feedback.hidden=false;
  confirm.focus();
 });
}
