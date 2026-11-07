/**
 * Station coordinates: optional GPS or an interactive pin on OpenStreetMap.
 * GPS prompts only after a user clicks. Coordinates remain form-only until
 * an existing, explicit Save submits the station profile.
 *
 * Leaflet 1.9.4 is loaded ONLY when the map is opened.
 * Public OSM tiles are for light interactive admin use (no prefetch/bulk use);
 * attribution remains visible and the app can swap the provider later.
 */
const LEAFLET_JS='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_INTEGRITY='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const LEAFLET_CSS_INTEGRITY='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
export const OPENSTREETMAP_TILES='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_COPYRIGHT='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const DEFAULT_CENTER=[15.87,100.992]; // Thailand overview only; never auto-saved.

let leafletPromise=null;
function leafletAssets(){
 if(globalThis.L?.map&&globalThis.L?.tileLayer)return Promise.resolve(globalThis.L);
 if(leafletPromise)return leafletPromise;
 leafletPromise=new Promise((resolve,reject)=>{
  const doc=document;
  if(!doc.getElementById('os-leaflet-css')){
   const css=doc.createElement('link');
   css.id='os-leaflet-css';css.rel='stylesheet';css.href=LEAFLET_CSS;
   css.integrity=LEAFLET_CSS_INTEGRITY;css.crossOrigin='anonymous';
   doc.head.append(css);
  }
  const script=doc.createElement('script');
  script.src=LEAFLET_JS;script.integrity=LEAFLET_JS_INTEGRITY;
  script.crossOrigin='anonymous';script.async=true;
  script.onload=()=>{
   if(globalThis.L?.map&&globalThis.L?.tileLayer)resolve(globalThis.L);
   else reject(new Error('leaflet_not_available'));
  };
  script.onerror=()=>reject(new Error('leaflet_load_failed'));
  doc.head.append(script);
 }).catch(err=>{leafletPromise=null;throw err;});
 return leafletPromise;
}

export function normalizedStationCoordinates(lat,lng){
 const valid=(value,min,max)=>{
  const text=String(value??'').trim();
  if(!/^-?[0-9]{1,3}(?:\.[0-9]{1,7})?$/.test(text))return null;
  const number=Number(text);
  return Number.isFinite(number)&&number>=min&&number<=max?number:null;
 };
 const latitude=valid(lat,-90,90),longitude=valid(lng,-180,180);
 return latitude===null||longitude===null?null:[latitude,longitude];
}

export function gpsStatusMessage(error){
 switch(error?.code){
  case 1:return 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาต GPS ในเบราว์เซอร์ หรือเลือกตำแหน่งบนแผนที่';
  case 2:return 'อุปกรณ์ไม่สามารถระบุตำแหน่งได้ กรุณาลองอีกครั้งหรือปักหมุดบนแผนที่';
  case 3:return 'การอ่าน GPS ใช้เวลานานเกินไป กรุณาลองใหม่หรือเลือกตำแหน่งบนแผนที่';
  default:return 'ไม่สามารถอ่าน GPS ได้ กรุณาเลือกพิกัดบนแผนที่หรือกรอกด้วยตนเอง';
 }
}

const currentPickers=new WeakMap();
export function disposeStationLocationPicker(panel){
 currentPickers.get(panel)?.();
 currentPickers.delete(panel);
}
export function mountStationLocationPicker({panel,fields}){
 if(!panel||!fields)return null;
 disposeStationLocationPicker(panel);
 const latitude=fields.querySelector('[name="latitude"]');
 const longitude=fields.querySelector('[name="longitude"]');
 if(!latitude||!longitude)return null;
 let map=null,marker=null,destroyed=false,mapBusy=false;
 const root=document.createElement('div');
 root.className='os-station-location-picker os-profile-wide';
 const toolbar=document.createElement('div');toolbar.className='os-station-location-toolbar';
 const title=document.createElement('strong');title.textContent='ระบุตำแหน่งปั๊มบนแผนที่';
 const buttons=document.createElement('div');buttons.className='os-station-location-actions';
 const gps=document.createElement('button');gps.type='button';
 gps.className='button secondary os-station-location-gps';gps.textContent='ใช้ GPS เครื่องนี้';
 const toggle=document.createElement('button');toggle.type='button';
 toggle.className='button secondary os-station-location-map-toggle';
 toggle.textContent='เลือกพิกัดบนแผนที่';toggle.setAttribute('aria-expanded','false');
 const status=document.createElement('p');status.className='os-station-location-feedback';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.textContent='GPS ใช้ตำแหน่งของเครื่องที่กำลังเปิดหน้านี้ หากอยู่คนละที่กับปั๊มให้ปักหมุดบนแผนที่แทน';
 const mapBox=document.createElement('div');mapBox.className='os-station-location-map-wrap';
 mapBox.hidden=true;
 const mapCanvas=document.createElement('div');mapCanvas.className='os-station-location-map';
 mapCanvas.setAttribute('role','region');
 mapCanvas.setAttribute('aria-label','แผนที่เลือกที่ตั้งปั๊ม คลิกตำแหน่งที่ต้องการปักหมุด');
 const helper=document.createElement('p');helper.className='os-station-location-help';
 helper.textContent='เลื่อนและซูมเพื่อหาปั๊ม แล้วคลิกบนแผนที่เพื่อปักหมุด พิกัดจะถูกบันทึกเมื่อกด “บันทึกรายละเอียดปั๊ม” เท่านั้น';
 mapBox.append(mapCanvas,helper);
 buttons.append(gps,toggle);toolbar.append(title,buttons);
 root.append(toolbar,status,mapBox);
 fields.append(root);

 function report(text,tone='neutral'){
  if(destroyed)return;
  status.textContent=text;status.dataset.tone=tone;
 }
 function mark(lat,lng,move){
  if(!map)return;
  const coords=[lat,lng];
  if(!marker){
   marker=globalThis.L.circleMarker(coords,{
    radius:9,color:'#FFF3C6',weight:3,
    fillColor:'#B89350',fillOpacity:1,
   }).addTo(map);
  }else marker.setLatLng(coords);
  if(move)map.setView(coords,16);
 }
 function setCoordinates(lat,lng,source='map'){
  const values=normalizedStationCoordinates(lat,lng);
  if(!values||destroyed)return false;
  // Input values are the single source of truth for existing profile saving.
  latitude.value=values[0].toFixed(7).replace(/0+$/,'').replace(/\.$/,'');
  longitude.value=values[1].toFixed(7).replace(/0+$/,'').replace(/\.$/,'');
  latitude.dispatchEvent(new Event('input',{bubbles:true}));
  longitude.dispatchEvent(new Event('input',{bubbles:true}));
  mark(values[0],values[1],true);
  report(source==='gps'?'ได้รับพิกัด GPS แล้ว ตรวจสอบว่าหมุดอยู่ตรงปั๊มก่อนบันทึก':
   'ปักหมุดบนแผนที่แล้ว กรุณากดบันทึกรายละเอียดปั๊มเพื่อยืนยัน','success');
  return true;
 }
 function onManualEdit(){
  const value=normalizedStationCoordinates(latitude.value,longitude.value);
  if(value){
   mark(value[0],value[1],true);
   report('พิกัดที่กรอกใช้ได้ กดบันทึกรายละเอียดปั๊มเพื่อยืนยัน');
  }else if(latitude.value.trim()||longitude.value.trim()){
   report('กรุณากรอกละติจูดและลองจิจูดให้ครบและอยู่ในช่วงที่ถูกต้อง','warning');
  }else{
   marker?.remove();marker=null;
   report('ยังไม่ได้กำหนดพิกัดของปั๊ม');
  }
 }
 latitude.addEventListener('change',onManualEdit);
 longitude.addEventListener('change',onManualEdit);

 gps.addEventListener('click',()=>{
  if(destroyed)return;
  if(!globalThis.isSecureContext||!navigator.geolocation?.getCurrentPosition){
   report('GPS ต้องใช้งานผ่าน HTTPS และเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ เลือกบนแผนที่แทนได้','warning');
   return;
  }
  gps.disabled=true;report('กำลังขอตำแหน่ง GPS ของอุปกรณ์…');
  navigator.geolocation.getCurrentPosition(
   position=>{
    if(destroyed)return;
    gps.disabled=false;
    if(setCoordinates(position.coords.latitude,position.coords.longitude,'gps')){
     const accuracy=position.coords.accuracy;
     if(Number.isFinite(accuracy))report(
      'รับตำแหน่ง GPS แล้ว (ความแม่นยำประมาณ '+Math.round(accuracy)+' เมตร) ตรวจสอบหมุดก่อนบันทึก','success');
    }
   },
   error=>{if(destroyed)return;gps.disabled=false;report(gpsStatusMessage(error),'warning');},
   {enableHighAccuracy:true,timeout:12000,maximumAge:0},
  );
 });

 toggle.addEventListener('click',async()=>{
  if(destroyed||mapBusy)return;
  if(!mapBox.hidden){
   mapBox.hidden=true;toggle.textContent='เลือกพิกัดบนแผนที่';
   toggle.setAttribute('aria-expanded','false');
   return;
  }
  mapBox.hidden=false;toggle.textContent='ปิดแผนที่';
  toggle.setAttribute('aria-expanded','true');
  if(map){map.invalidateSize();return;}
  mapBusy=true;toggle.disabled=true;report('กำลังเปิดแผนที่ OpenStreetMap…');
  try{
   const L=await leafletAssets();
   if(destroyed||!mapCanvas.isConnected)return;
   const initial=normalizedStationCoordinates(latitude.value,longitude.value);
   map=L.map(mapCanvas,{scrollWheelZoom:false});
   map.setView(initial||DEFAULT_CENTER,initial?15:6);
   L.tileLayer(OPENSTREETMAP_TILES,{
    attribution:OSM_COPYRIGHT,maxZoom:19,
    updateWhenIdle:true, // no speculative tile pre-fetch
   }).addTo(map);
   map.on('click',event=>{
    if(!event.latlng)return;
    setCoordinates(event.latlng.lat,event.latlng.lng,'map');
   });
   if(initial)mark(initial[0],initial[1],false);
   map.invalidateSize();
   report(initial?'แสดงพิกัดที่บันทึกไว้แล้ว คลิกจุดใหม่เพื่อแก้ไข':
    'เลื่อนแผนที่มาหาปั๊ม แล้วคลิกจุดที่ต้องการปักหมุด');
  }catch{
   if(destroyed)return;
   mapBox.hidden=true;toggle.textContent='เลือกพิกัดบนแผนที่';
   toggle.setAttribute('aria-expanded','false');
   report('โหลดแผนที่ไม่ได้ แต่ยังใช้ GPS หรือกรอกละติจูดและลองจิจูดได้','warning');
  }finally{mapBusy=false;if(!destroyed)toggle.disabled=false;}
 });
 const dispose=()=>{
  destroyed=true;
  latitude.removeEventListener('change',onManualEdit);
  longitude.removeEventListener('change',onManualEdit);
  try{map?.remove();}catch{}
  map=null;marker=null;
 };
 currentPickers.set(panel,dispose);
 return {root,setCoordinates,dispose};
}
