import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const qa=readFileSync('e2e/platform.qa.pw.mjs','utf8');
const progressive=readFileSync('src/client/progressive-workspace.js','utf8');
const submenus=readFileSync('src/client/functional-submenus.js','utf8');

test('station create QA uses actual visible add FAB instead of hidden functional pane',()=>{
 assert.match(progressive,/stations:\{title:'สร้างปั๊มน้ำมัน'/);
 assert.match(progressive,/fab=makeButton\(task\.title,'plus','os-add-fab'\)/);
 assert.match(progressive,/surface\.hidden=true/);
 assert.match(progressive,/fab\.addEventListener\('click'/);
 assert.match(submenus,/start:'directory'/);
 assert.match(qa,/locator\('\[data-ws-screen="stations"\] > \.os-add-fab'\)/);
 assert.match(qa,/await addStation\.click\(\)/);
 assert.match(qa,/await expect\(page\.locator\('#new-station-form'\)\)\.toBeVisible\(\)/);
 assert.match(qa,/await directoryTab\.click\(\)/);
 assert.doesNotMatch(qa,/const createTab =/);
});
