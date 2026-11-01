import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const clientSource=readFileSync(new URL('../src/client/hr-access-setup.js',import.meta.url),'utf8')
 .replace('export async function mountHrAccessSetup','async function mountHrAccessSetup');

const station='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const employee='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
const user='55555555-5555-4555-8555-555555555555';
async function setup(page){
 await page.goto('/');
 await page.addScriptTag({content:clientSource+'\\nwindow.__mountHrAccessSetup=mountHrAccessSetup;'});
 await page.evaluate(async ({station,employee,user})=>{
  const app=document.querySelector('#app');
  app.className='workspace-mode';
  app.innerHTML='<div class="os-midnight-layout"><div class="ws-main"><div class="ws-widget"><section id="hr-access-setup"></section></div></div></div>';
  const setup={
   employees:[{id:employee,name:'พนักงานทดสอบ',code:'QA-001',linked:false}],
   accounts:[{userId:user,name:'บัญชีทดสอบ',role:'attendant'}],
   geofence:{configured:false,latitude:null,longitude:null,radiusMeters:null,maxAccuracyMeters:null},
  };
  window.__hrApiCalls=[];
  const getApi=async (path,_token,init={})=>{
   const body=init.body?JSON.parse(init.body):null;
   window.__hrApiCalls.push({path,body});
   if(path.startsWith('/api/hr/link-setup'))return {ok:true,data:{setup}};
   if(path==='/api/hr/employee-link'){
    if(body.stationId!==station||body.employeeId!==employee||body.userId!==user)
     return {ok:false,status:403,data:{}};
    setup.employees[0].linked=true;setup.accounts=[];
    return {ok:true,data:{result:{replayed:false}}};
   }
   if(path==='/api/hr/geofence'){
    if(body.stationId!==station)return {ok:false,status:403,data:{}};
    setup.geofence={configured:true,latitude:body.latitude,longitude:body.longitude,
      radiusMeters:body.radiusMeters,maxAccuracyMeters:body.maxAccuracyMeters};
    return {ok:true,data:{result:{configured:true}}};
   }
   return {ok:false,status:404,data:{}};
  };
  await window.__mountHrAccessSetup({target:document.getElementById('hr-access-setup'),
    stationId:station,token:'qa-fixture-token',getApi});
 },{station,employee,user});
}
test('HR managers can select an authorized account; linked accounts disappear @hr-access',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await setup(page);
 await expect(page.locator('#hr-link-employee option')).toHaveCount(1);
 await expect(page.locator('#hr-link-user option')).toHaveCount(1);
 await expect(page.locator('#hr-link-save')).toBeEnabled();
 await page.locator('#hr-link-save').click();
 await expect(page.locator('#hr-link-user option')).toHaveCount(0);
 await expect(page.locator('#hr-link-save')).toBeDisabled();
 const calls=await page.evaluate(()=>window.__hrApiCalls);
 expect(calls.find(x=>x.path==='/api/hr/employee-link').body)
  .toEqual({stationId:station,employeeId:employee,userId:user});
 expect(await page.locator('#hr-access-setup').evaluate(el=>el.scrollWidth<=el.clientWidth+2)).toBe(true);
});
test('Geofence requires explicit save and fits phone/Desktop without horizontal clipping @hr-access',async({page})=>{
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:900});
  await setup(page);
  await page.locator('#hr-geo-lat').fill('13.7563');
  await page.locator('#hr-geo-lon').fill('100.5018');
  await page.locator('#hr-geo-radius').fill('150');
  await page.locator('#hr-geo-accuracy').fill('100');
  const before=await page.evaluate(()=>window.__hrApiCalls);
  expect(before.some(x=>x.path==='/api/hr/geofence')).toBe(false);
  await page.locator('#hr-geo-save').click();
  await expect(page.locator('#hr-access-status')).toContainText('บันทึกเขต GPS แล้ว');
  const state=await page.evaluate(()=>({
   calls:window.__hrApiCalls,
   viewport:document.documentElement.clientWidth,
   page:document.documentElement.scrollWidth,
   card:document.getElementById('hr-access-setup').getBoundingClientRect().toJSON(),
  }));
  expect(state.calls.find(x=>x.path==='/api/hr/geofence').body)
   .toEqual({stationId:station,latitude:13.7563,longitude:100.5018,
     radiusMeters:150,maxAccuracyMeters:100});
  expect(state.page,'Horizontal overflow at '+width+'px').toBeLessThanOrEqual(state.viewport+2);
  expect(state.card.right).toBeLessThanOrEqual(state.viewport+2);
 }
});
