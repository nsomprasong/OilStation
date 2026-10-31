import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync('src/client/main.js','utf8');
const spec=readFileSync('e2e/platform.qa.pw.mjs','utf8');
test('Sales station submit is disabled until brand/list preflight and submit handler installed',()=>{
 const st=code.indexOf("const stationSubmit=el('new-station-submit')");
 const request=code.indexOf("getApi('/api/fuel-brands',accessToken)",st);
 const list=code.indexOf('await loadStations()',request);
 const ready=code.indexOf('stationCreateReady=true',list);
 const handler=code.indexOf("newStationForm.addEventListener('submit'",ready);
 const enable=code.indexOf('stationSubmit.disabled=!stationCreateReady;',handler);
 assert.ok(st>0&&request>st&&list>request&&ready>list&&handler>ready&&enable>handler);
 assert.match(code,/newStationForm\.dataset\.osStationSubmitReady=String\(stationCreateReady\)/);
 assert.match(spec,/toHaveAttribute\('data-os-station-submit-ready', 'true'\)/);
 assert.match(spec,/invalidControls/);
});
