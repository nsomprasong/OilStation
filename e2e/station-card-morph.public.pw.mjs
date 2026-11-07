import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/client/station-card-morph.js')
 .replace(/^export /gm,'')+
 '\nwindow.__stationMorph={editIconRect,morphStationDetails};';

async function mount(page){
 await page.goto('/');
 await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
 await page.evaluate(()=>{
  const app=document.getElementById('app');
  app.className='workspace-mode';
  app.innerHTML=`
   <section data-ws-screen="stations" style="max-width:860px;margin:16px auto">
    <div class="os-station-directory">
     <div id="qa-list" style="min-height:260px">
      <article class="module-item os-station-card os-station-card--editable" style="width:min(100%,300px);margin-top:85px">
       <div class="os-station-card-head">
        <div class="os-station-card-identity"><h4 class="os-station-card-name">QA-S01-A</h4>
        <p class="os-station-card-brand">PTT Station</p></div>
       </div>
       <div class="os-station-card-body"><p class="os-station-card-organization">QA Organization</p>
        <div class="os-station-service-list"><span class="os-station-status is-enabled">เปิดบริการ</span></div>
       </div>
       <div class="os-station-actions"><button type="button" id="qa-edit"
         class="button os-station-manage os-station-edit-icon"
         aria-label="แก้ไขรายละเอียด QA-S01-A" title="แก้ไขรายละเอียด QA-S01-A">✎</button></div>
      </article>
     </div>
     <div id="qa-details" class="os-station-details-panel" hidden>
      <div class="os-profile-page-heading">
       <button type="button" id="qa-back" class="button os-profile-back">กลับไปรายการปั๊ม</button>
       <h3>แก้ไขรายละเอียดปั๊ม</h3>
      </div>
      <section class="os-profile-section"><div class="os-profile-section-head"><h4>ข้อมูลสาขา</h4></div>
       <div class="os-profile-form-grid">
       ${Array.from({length:8},(_,i)=>`<label class="os-profile-field">ข้อมูล ${i}
        <input aria-label="ข้อมูล ${i}" value="QA Station"></label>`).join('')}
       </div></section>
      <section class="os-profile-section"><div class="os-profile-section-head"><h4>ข้อมูลผู้ออกใบกำกับภาษี</h4></div>
       <div class="os-profile-form-grid">
       ${Array.from({length:10},(_,i)=>`<label class="os-profile-field">ภาษี ${i}
        <input aria-label="ภาษี ${i}" value="QA"></label>`).join('')}
       </div></section>
      <section class="os-profile-section"><div class="os-profile-section-head"><h4>ราคาน้ำมันของ QA-S01-A</h4></div>
       <div class="os-profile-form-grid"><input aria-label="ราคา" value="35.90"></div></section>
     </div>
    </div>
   </section>`;
 });
 await page.addStyleTag({content:read('public/oilstation.css')});
 await page.addScriptTag({type:'module',content:source});
 await page.waitForFunction(()=>!!window.__stationMorph);
 await page.evaluate(()=>{
  const edit=document.querySelector('#qa-edit');
  const back=document.querySelector('#qa-back');
  const list=document.querySelector('#qa-list');
  const panel=document.querySelector('#qa-details');
  let busy=false,queued=false,origin=null,scrollY=0;
  window.__qaMorphEvents=[];
  window.__qaReducedSnaps=0;
  async function open(){
   if(busy||!panel.hidden)return;
   busy=true;origin=window.__stationMorph.editIconRect(edit);
   scrollY=window.scrollY;
   list.hidden=true;panel.hidden=false;
   panel.scrollIntoView({block:'start',behavior:'instant'});
   const played=await window.__stationMorph.morphStationDetails(panel,origin,{direction:'open'});
   if(!played)window.__qaReducedSnaps++;
   window.__qaMorphEvents.push('open-finished');
   busy=false;
   if(queued){queued=false;void close();}
  }
  async function close(){
   if(panel.hidden)return;
   if(busy){queued=true;return;}
   busy=true;
   panel.scrollIntoView({block:'start',behavior:'instant'});
   const played=await window.__stationMorph.morphStationDetails(panel,origin,{direction:'close'});
   if(!played)window.__qaReducedSnaps++;
   panel.hidden=true;list.hidden=false;
   window.scrollTo({top:scrollY,behavior:'instant'});
   edit.focus({preventScroll:true});
   busy=false;window.__qaMorphEvents.push('close-finished');
  }
  edit.addEventListener('click',()=>{void open();});
  back.addEventListener('click',()=>{void close();});
 });
}

test('@public 1440px station editor expands from pencil and shrinks back into same pencil',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mount(page);
 const edit=page.locator('#qa-edit');
 await expect(edit).toBeVisible();
 const before=await edit.boundingBox();
 await edit.click();
 await page.waitForTimeout(150);
 const during=await page.locator('#qa-details').evaluate(el=>{
  const t=getComputedStyle(el).transform;return t==='none'?1:new DOMMatrix(t).a;
 });
 expect(during).toBeGreaterThan(0);
 expect(during).toBeLessThan(.99);
 await page.waitForFunction(()=>window.__qaMorphEvents.includes('open-finished'));
 await expect(page.getByRole('heading',{name:'ข้อมูลผู้ออกใบกำกับภาษี'})).toBeVisible();
 await expect(page.locator('#qa-list')).toBeHidden();
 await page.locator('#qa-back').click();
 await page.waitForTimeout(90);
 const closing=await page.locator('#qa-details').evaluate(el=>{
  const t=getComputedStyle(el).transform;return t==='none'?1:new DOMMatrix(t).a;
 });
 expect(closing).toBeLessThan(.99);
 await page.waitForFunction(()=>window.__qaMorphEvents.includes('close-finished'));
 await expect(edit).toBeVisible();
 await expect(edit).toBeFocused();
 const after=await edit.boundingBox();
 expect(Math.abs(after.x-before.x)).toBeLessThan(3);
 expect(Math.abs(after.y-before.y)).toBeLessThan(3);
 await expect(page.locator('#qa-details')).toBeHidden();
});

test('@public repeated opening/closing 8 times never locks UI or duplicates detail state',async({page})=>{
 test.setTimeout(30000);
 await page.setViewportSize({width:1080,height:780});
 await mount(page);
 for(let i=0;i<8;i++){
  await page.locator('#qa-edit').click();
  await page.waitForFunction(n=>window.__qaMorphEvents.filter(x=>x==='open-finished').length>=n,i+1);
  await page.locator('#qa-back').click();
  await page.waitForFunction(n=>window.__qaMorphEvents.filter(x=>x==='close-finished').length>=n,i+1);
  await expect(page.locator('#qa-edit')).toBeVisible();
 }
 expect(await page.evaluate(()=>window.__qaMorphEvents.length)).toBe(16);
 await page.locator('#qa-edit').focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__qaMorphEvents.filter(x=>x==='open-finished').length===9);
 await expect(page.locator('#qa-details')).toBeVisible();
});

test('@public 320px + reduced motion navigates instantly with no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(page);
 await page.locator('#qa-edit').click();
 await page.waitForFunction(()=>window.__qaMorphEvents.includes('open-finished'));
 await expect(page.locator('#qa-details')).toBeVisible();
 await page.locator('#qa-back').click();
 await page.waitForFunction(()=>window.__qaMorphEvents.includes('close-finished'));
 expect(await page.evaluate(()=>window.__qaReducedSnaps)).toBe(2);
 const v=await page.evaluate(()=>({
  scrollWidth:document.documentElement.scrollWidth,
  clientWidth:document.documentElement.clientWidth,
  hidden:document.querySelector('#qa-details').hidden,
 }));
 expect(v.hidden).toBe(true);
 expect(v.scrollWidth).toBeLessThanOrEqual(v.clientWidth+2);
 await expect(page.locator('#qa-edit')).toBeVisible();
});
