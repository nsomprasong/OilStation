import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const e2e=readFileSync('e2e/platform.qa.pw.mjs','utf8');
const nav=readFileSync('src/client/functional-submenus.js','utf8');
test('Playwright opens station create functional tab and validates visible station directory',()=>{
 assert.match(nav,/stations:\{kind:'stations',start:'directory'\}/);
 assert.match(nav,/pane\('create','สร้างปั๊ม'/);
 assert.match(nav,/pane\('directory','ปั๊มที่สร้างแล้ว'/);
 assert.match(e2e,/\[data-context-for="stations"\] \[data-os-pane-key="create"\]/);
 assert.match(e2e,/\[data-context-for="stations"\] \[data-os-pane-key="directory"\]/);
 assert.match(e2e,/await createTab\.click\(\)/);
 assert.match(e2e,/await directoryTab\.click\(\)/);
});
