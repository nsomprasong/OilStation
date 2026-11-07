import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stationMorphFrames,canMorph} from '../../src/client/station-card-morph.js';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const main=read('src/client/main.js');
const css=read('public/oilstation.css');

test('station morph starts at exact pencil icon center and reverses into the same icon',()=>{
 const icon={x:655,y:545,width:42,height:42};
 const detail={x:250,y:140,width:830,height:1220};
 const open=stationMorphFrames(icon,detail,'open');
 const close=stationMorphFrames(icon,detail,'close');
 assert.ok(open);
 assert.ok(open[0].transform.includes('translate3d('));
 assert.ok(open[0].transform.includes('scale('));
 const transform=open[0].transform.match(/^translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([-\d.]+)\)$/);
 assert.ok(transform,'start uses translated icon center');
 assert.equal(Number(transform[1]),icon.x+icon.width/2-(detail.x+detail.width/2));
 assert.equal(Number(transform[2]),icon.y+icon.height/2-(detail.y+detail.height/2));
 assert.ok(Number(transform[3])>0 && Number(transform[3])<.21);
 assert.deepEqual(close,[open[1],open[0]]);
 assert.equal(open[1].transform,'translate3d(0px,0px,0) scale(1)');
});

test('invalid geometry fails closed instead of jumping to an arbitrary location',()=>{
 assert.equal(stationMorphFrames(null,{x:1,y:2,width:300,height:800}),null);
 assert.equal(stationMorphFrames({x:1,y:2,width:0,height:42},{x:0,y:0,width:300,height:800}),null);
 assert.equal(canMorph(null,null),false);
});

test('Super Admin cards show icon-only bottom-right pencil without affecting Sales handoffs',()=>{
 assert.match(main,/edit\.className='button os-station-manage os-station-edit-icon'/);
 assert.match(main,/edit\.append\(makeIcon\('edit'\)\)/);
 assert.match(main,/edit\.dataset\.stationId=s\.id/);
 assert.match(main,/edit\.setAttribute\('aria-label',edit\.title\)/);
 assert.match(main,/node\.classList\.add\('os-station-card--editable'\)/);
 assert.match(main,/void openDetails\(s,edit\)/);
 assert.match(main,/createInviteControl\(accessToken,'organization'/);
 assert.match(main,/createInviteControl\(accessToken,'station'/);
 assert.match(css,/\.os-station-card--editable \.os-station-actions\{/);
 assert.match(css,/\.os-station-edit-icon\.button\{/);
 assert.match(css,/justify-content:flex-end/);
 assert.match(css,/border-radius:13px!important/);
});

test('reversible transition is bounded, keyboard accessible, safe for rapid clicks and reduced motion',()=>{
 const transition=read('src/client/station-card-morph.js');
 assert.match(main,/if\(salesMode\|\|transitionBusy\|\|!detailsTarget\.hidden\)return/);
 assert.match(main,/if\(transitionBusy\)\{closeQueued=true;return;\}/);
 assert.match(main,/sourceIconRect=editIconRect\(button\)/);
 assert.match(main,/await morphStationDetails\(detailsTarget,sourceIconRect,\{direction:'open'\}\)/);
 assert.match(main,/await morphStationDetails\(detailsTarget,sourceIconRect,\{direction:'close'\}\)/);
 assert.match(main,/window\.scrollTo\(\{top:returnScrollY,behavior:'instant'\}\)/);
 assert.match(main,/button\?\.focus\(\{preventScroll:true\}\)/);
 assert.match(transition,/prefers-reduced-motion: reduce/);
 assert.match(transition,/Promise\.race/);
 assert.match(transition,/clearTimeout\(timer\)/);
 assert.match(transition,/anim\?\.cancel\(\)/);
 assert.doesNotMatch(transition,/MutationObserver|document\.addEventListener/);
 assert.match(css,/\.os-station-edit-icon:focus-visible/);
});
