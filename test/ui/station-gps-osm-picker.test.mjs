import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedStationCoordinates,gpsStatusMessage,OPENSTREETMAP_TILES}
 from '../../src/client/station-location-picker.js';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const picker=read('src/client/station-location-picker.js');
const details=read('src/client/platform-station-details.js');
const main=read('src/client/main.js');
const markup=read('index.html');
const css=read('public/oilstation.css');

test('station location accepts valid Bangkok/Thailand coordinates and valid equator',()=>{
 assert.deepEqual(normalizedStationCoordinates('13.7563000','100.5018000'),[13.7563,100.5018]);
 assert.deepEqual(normalizedStationCoordinates('0','0'),[0,0]);
 assert.deepEqual(normalizedStationCoordinates(-90,180),[-90,180]);
 assert.deepEqual(normalizedStationCoordinates(' 15.87 ','100.992'),[15.87,100.992]);
});
test('GPS / map location cannot submit invalid or partial coordinates',()=>{
 for(const [lat,lng] of [['','100'],['13',''],['-90.1','0'],
  ['91','100'],['13','181'],['13.75','abc'],['1e2','100'],['nan','100'],
  ['13.12345678','100'],['<script>','100']]){
  assert.equal(normalizedStationCoordinates(lat,lng),null,lat+','+lng);
 }
});
test('GPS error distinguishes permission denial, timeout and unavailable',()=>{
 assert.match(gpsStatusMessage({code:1}),/อนุญาต/);
 assert.match(gpsStatusMessage({code:2}),/ไม่สามารถระบุตำแหน่ง/);
 assert.match(gpsStatusMessage({code:3}),/นานเกินไป/);
 assert.match(gpsStatusMessage(null),/ไม่สามารถอ่าน GPS/);
});
test('map provider is optional/lazy, pinned with SRI and OSM attribution; referrer identifies site origin',()=>{
 assert.equal(OPENSTREETMAP_TILES,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 assert.match(picker,/cdn\.jsdelivr\.net\/npm\/leaflet@1\.9\.4\/dist\/leaflet\.js/);
 assert.match(picker,/LEAFLET_JS_INTEGRITY='sha256-/);
 assert.match(picker,/LEAFLET_CSS_INTEGRITY='sha256-/);
 assert.match(picker,/async\(\)=>\{/);
 assert.match(picker,/attribution:OSM_COPYRIGHT/);
 assert.match(picker,/updateWhenIdle:true/);
 assert.match(markup,/<meta name="referrer" content="strict-origin-when-cross-origin">/);
 assert.doesNotMatch(markup,/tile\.openstreetmap\.org/); // no speculative load
});
test('GPS is user-initiated and never auto-writes backend or overwrites another station',()=>{
 assert.match(picker,/gps\.addEventListener\('click'/);
 assert.match(picker,/navigator\.geolocation\.getCurrentPosition\(/);
 assert.match(picker,/toggle\.addEventListener\('click',async\(\)=>\{/);
 assert.match(picker,/map\.on\('click',event=>\{/);
 assert.match(picker,/latitude\.dispatchEvent\(new Event\('input'/);
 assert.match(picker,/longitude\.dispatchEvent\(new Event\('input'/);
 assert.doesNotMatch(picker,/fetch\(|getApi\(|localStorage|stationId/);
 assert.match(details,/mountStationLocationPicker\(\{panel:target,fields\}\)/);
 assert.match(main,/disposeStationLocationPicker\(detailsTarget\)/);
 assert.match(css,/\.os-station-location-map-wrap\[hidden\]/);
});
