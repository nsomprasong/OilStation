import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const domain=read('src/domain/station-profile.mjs')
 .replace(/export const /g,'const ').replace(/export function /g,'function ');
const editor=read('src/client/platform-station-details.js')
 .replace(/^import .*;\s*$/gm,'')
 .replace('export async function mountPlatformStationDetails',
  'async function mountPlatformStationDetails');
const source=domain+'\n'+editor+'\nwindow.__mountProfile=mountPlatformStationDetails;';
const stationId='22222222-2222-4222-8222-222222222222';
const savedProfile={
 stationId,stationName:'QA-S01-A',organizationName:'QA Organization S01-A',
 brandName:'PTT Station',brandCode:'PTT',timezone:'Asia/Bangkok',
 address:'',latitude:'',longitude:'',contactName:'',stationPhone:'',stationEmail:'',
 postalCode:'',invoiceIssuerName:'',invoiceTaxId:'',invoiceBranchCode:'',
 invoiceAddress:'',invoicePhone:'',invoiceEmail:'',vatRegistered:false,
};
async function mount(page){
 await page.goto('/');
 await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
 await page.evaluate(()=>{
  const app=document.getElementById('app');
  app.className='workspace-mode';
  app.innerHTML='<section data-ws-screen="stations"><div id="station-details-panel" class="os-station-details-panel"></div></section>';
 });
 await page.addStyleTag({content:read('public/oilstation.css')});
 await page.addScriptTag({type:'module',content:source});
 await page.waitForFunction(()=>typeof window.__mountProfile==='function');
 await page.evaluate(async({id,profile})=>{
  window.__saved=[];
  window.__fuelStationIds=[];
  const target=document.getElementById('station-details-panel');
  await window.__mountProfile({
   target,station:{id,stationName:profile.stationName},token:'fixture',
   getApi:async(url,_token,init)=>{
    if(url.includes('/update')){
     const body=JSON.parse(init.body);
     window.__saved.push(body);
     return {ok:true,data:{profile:{...profile,...body.details}}};
    }
    return {ok:true,data:{profile}};
   },
   fuelEditor:async(_token,stationId,host)=>{
    window.__fuelStationIds.push(stationId);
    const title=document.createElement('p');
    title.className='qa-fuel-station-id';
    title.textContent='ราคาน้ำมันของ '+stationId;
    host.append(title);
   },
   onBack:()=>{target.hidden=true;},
   onSaved:profile=>{window.__newName=profile.stationName;},
  });
 },{id:stationId,profile:savedProfile});
}
test('@public station details desktop: VAT invoice fields and correct station-scoped fuel editor',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await mount(page);
 await expect(page.getByRole('heading',{name:'แก้ไขรายละเอียดปั๊ม'})).toBeVisible();
 await expect(page.getByText('QA Organization S01-A')).toBeVisible();
 await expect(page.getByRole('heading',{name:'ข้อมูลผู้ออกใบกำกับภาษี'})).toBeVisible();
 expect(await page.evaluate(()=>window.__fuelStationIds)).toEqual([stationId]);
 await page.locator('#station-detail-invoiceIssuerName').fill('QA LIMITED');
 await page.locator('#station-detail-invoiceTaxId').fill('0123456789012');
 await page.locator('#station-detail-invoiceBranchCode').fill('00000');
 await page.locator('#station-detail-invoiceAddress').fill('100 Example Road');
 await page.locator('input[name="vatRegistered"]').check();
 await page.locator('#station-detail-stationName').fill('QA-S01-A NEW');
 await page.getByRole('button',{name:'บันทึกรายละเอียดปั๊ม'}).click();
 await expect(page.getByText('บันทึกรายละเอียดของปั๊มนี้แล้ว')).toBeVisible();
 const results=await page.evaluate(()=>({saved:window.__saved,name:window.__newName}));
 expect(results.saved).toHaveLength(1);
 expect(results.saved[0].stationId).toBe(stationId);
 expect(results.saved[0].details.invoiceTaxId).toBe('0123456789012');
 expect(results.saved[0].details.invoiceBranchCode).toBe('00000');
 expect(results.saved[0].details.vatRegistered).toBe(true);
 expect(results.name).toBe('QA-S01-A NEW');
 await page.getByRole('button',{name:'กลับไปรายการปั๊ม'}).click();
 await expect(page.locator('#station-details-panel')).toBeHidden();
});
test('@public mobile: 320px single-column tax form, invalid tax ID never saved',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await mount(page);
 await page.locator('#station-detail-invoiceIssuerName').fill('QA LIMITED');
 await page.locator('#station-detail-invoiceTaxId').fill('123');
 await page.locator('#station-detail-invoiceBranchCode').fill('00000');
 await page.locator('#station-detail-invoiceAddress').fill('100 Example Road');
 await page.locator('input[name="vatRegistered"]').check();
 await page.getByRole('button',{name:'บันทึกรายละเอียดปั๊ม'}).click();
 expect(await page.evaluate(()=>window.__saved.length)).toBe(0);
 const widths=await page.evaluate(()=>{
  const card=document.querySelector('.os-station-details-panel');
  return {viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
   card:card.getBoundingClientRect().width};
 });
 expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
 expect(widths.card).toBeLessThanOrEqual(widths.viewport+2);
});
