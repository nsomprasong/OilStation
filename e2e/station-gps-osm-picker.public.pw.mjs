import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('src/client/station-location-picker.js')
 .replace(/^export /gm,'')+
 '\nwindow.__stationMap={mountStationLocationPicker,disposeStationLocationPicker};';

async function fixture(page){
 await page.goto('/');
 await expect(page.locator('#app.auth-mode .os-auth-card')).toBeVisible();
 await page.evaluate(()=>{
  const app=document.querySelector('#app');
  app.className='workspace-mode';
  app.innerHTML=`<section data-ws-screen="stations">
   <div class="os-station-details-panel"><div class="os-profile-form-grid" id="geo-form">
    <label class="os-profile-field">ละติจูด<input name="latitude" aria-label="ละติจูด"></label>
    <label class="os-profile-field">ลองจิจูด<input name="longitude" aria-label="ลองจิจูด"></label>
   </div></div></section>`;
  window.__savedCount=0; // no production API or DB writes
 });
 await page.addStyleTag({content:read('public/oilstation.css')});
 await page.addScriptTag({type:'module',content:source});
 await page.waitForFunction(()=>!!window.__stationMap);
 await page.evaluate(()=>{
  const panel=document.querySelector('.os-station-details-panel');
  window.__stationPicker=window.__stationMap.mountStationLocationPicker({
   panel,fields:document.querySelector('#geo-form'),
  });
 });
}

test('@public GPS is requested only on click; coordinates are staged and map click overrides pin',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await fixture(page);
 const lat=page.getByRole('textbox',{name:'ละติจูด'});
 const lng=page.getByRole('textbox',{name:'ลองจิจูด'});
 await expect(lat).toHaveValue('');
 await expect(lng).toHaveValue('');
 // The map is a public, optional control. Mock Leaflet to avoid automated
 // requests to OSM community tiles: OSM policy forbids prefetch/scraping.
 await page.evaluate(()=>{
  window.L={
   map:()=>({
    setView(coords,zoom){window.__mapView={coords,zoom};return this;},
    on(name,fn){if(name==='click')window.__pinClick=fn;return this;},
    invalidateSize(){return this;},
    remove(){window.__mapDestroyed=true;},
   }),
   tileLayer:(url,options)=>({
    addTo(){window.__mapTiles={url,attribution:options.attribution};},
   }),
   circleMarker:(coords)=>({
    addTo(){window.__mapMarker=coords;return this;},
    setLatLng(v){window.__mapMarker=v;return this;},
    remove(){window.__mapMarker=null;},
   }),
  };
 });
 await page.context().grantPermissions(['geolocation']);
 await page.context().setGeolocation({latitude:13.75632,longitude:100.50182,accuracy:35});
 await page.getByRole('button',{name:'ใช้ GPS เครื่องนี้'}).click();
 await expect(lat).toHaveValue('13.75632');
 await expect(lng).toHaveValue('100.50182');
 await expect(page.getByRole('status').filter({hasText:'รับตำแหน่ง GPS'})).toBeVisible();
 await page.getByRole('button',{name:'เลือกพิกัดบนแผนที่'}).click();
 await expect(page.locator('.os-station-location-map-wrap')).toBeVisible();
 await page.waitForFunction(()=>typeof window.__pinClick==='function');
 await page.evaluate(()=>window.__pinClick({latlng:{lat:14.6486,lng:101.1234567}}));
 await expect(lat).toHaveValue('14.6486');
 await expect(lng).toHaveValue('101.1234567');
 const result=await page.evaluate(()=>({
  saved:window.__savedCount,tiles:window.__mapTiles,pin:window.__mapMarker,
 }));
 expect(result.saved).toBe(0);
 expect(result.tiles.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 expect(result.tiles.attribution).toContain('OpenStreetMap');
 expect(result.pin).toEqual([14.6486,101.1234567]);
 await page.getByRole('button',{name:'ปิดแผนที่'}).click();
 await expect(page.locator('.os-station-location-map-wrap')).toBeHidden();
 await page.evaluate(()=>window.__stationMap.disposeStationLocationPicker(
  document.querySelector('.os-station-details-panel')));
 expect(await page.evaluate(()=>window.__mapDestroyed)).toBe(true);
});

test('@public 320px mobile: GPS permission denial shows fallback; malformed manual coordinates rejected',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await fixture(page);
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'geolocation',{
   configurable:true,value:{
    getCurrentPosition(_ok,fail){fail({code:1});},
   },
  });
 });
 await page.getByRole('button',{name:'ใช้ GPS เครื่องนี้'}).click();
 await expect(page.getByText(/ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง/)).toBeVisible();
 const lat=page.getByRole('textbox',{name:'ละติจูด'});
 const lng=page.getByRole('textbox',{name:'ลองจิจูด'});
 await lat.fill('91');await lng.fill('100');
 await lng.press('Tab');
 await expect(page.getByText(/กรุณากรอกละติจูดและลองจิจูดให้ครบ/)).toBeVisible();
 await lat.fill('13.7563');await lng.fill('100.5018');
 await lng.press('Tab');
 await expect(page.getByText(/พิกัดที่กรอกใช้ได้/)).toBeVisible();
 const widths=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth,
 }));
 expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
});
