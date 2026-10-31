import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPlatformSaasBilling,formattedBaht} from '../../src/client/platform-saas-billing.js';
import {validatePlanDraft,mountSaasPlanManager} from '../../src/client/saas-plan-manager.js';
import {readFileSync} from 'node:fs';
const source=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('platform SaaS UI keeps VAT separate from interactive plan management',()=>{
 const src=source('src/client/platform-saas-billing.js'),manager=source('src/client/saas-plan-manager.js');
 assert.equal(typeof mountPlatformSaasBilling,'function');
 assert.equal(typeof mountSaasPlanManager,'function');
 assert.match(src,/mountSaasPlanManager/);
 for(const word of ['vatMode','ratePercent','นโยบายภาษีมูลค่าเพิ่ม','os-tax-panel'])
   assert.ok(src.includes(word),word);
 for(const word of ['bundle-plan','archive-plan','edit-plan','plan-editor','saas-plan-list',
   'os-plan-price-review','showModal','กรอกครบทั้ง 3 ราคา','แพ็กเกจสำหรับปั๊มน้ำมัน']){
   assert.ok(manager.includes(word),word);
 }
 for(const removed of ["rpc('group'","rpc('subscription'","rpc('draft'","rpc('issue'"])
   assert.equal(src.includes(removed),false,removed);
 assert.doesNotMatch(manager,/window\.confirm|innerHTML/);
});

test('exact satang conversion and user-friendly data validation before save',()=>{
 assert.equal(formattedBaht('150000'),'1,500.00 บาท');
 assert.equal(formattedBaht('0'),'0.00 บาท');
 assert.equal(formattedBaht(undefined),'—');
 const base={name:'Standard รายปี',code:'standard_year',frequency:'yearly',
  couponBaht:'16000',hrBaht:'16000.5',bundleBaht:'25000.00',effectiveOn:'2026-11-01'};
 assert.deepEqual(validatePlanDraft(base),{body:{
  name:base.name,code:base.code,frequency:base.frequency,
  couponPriceSatang:'1600000',hrPriceSatang:'1600050',
  bundlePriceSatang:'2500000',effectiveOn:'2026-11-01',
 }});
 for(const bad of [{name:'x'},{code:'ไม่ใช่ภาษาอังกฤษ'},{bundleBaht:'25000.123'},
  {couponBaht:'16,000'},{bundleBaht:'9.99'},{effectiveOn:'2026-02-30'}]){
  assert.ok(validatePlanDraft({...base,...bad}).error,JSON.stringify(bad));
 }
});

test('owner plan selection is outside SaaS administration and station creation',()=>{
 const src=source('src/client/main.js');
 const a=src.indexOf('async function platformWorkspace('),b=src.indexOf('function dashboard(',a);
 const station=src.slice(a,b);
 assert.match(station,/createInviteControl/);
 assert.doesNotMatch(station,/planId|pricingPlanId|selectedPlanId/);
});

test('plan management has one intentional creation flow and safe editing + archiving',()=>{
 const src=source('src/client/saas-plan-manager.js');
 const progressive=source('src/client/progressive-workspace.js');
 assert.match(src,/function.*\bmountSaasPlanManager/);
 assert.match(src,/validatePlanDraft\(getForm\(\)\)/);
 assert.match(src,/form\.dispatchEvent\(new Event\('os:create-show'\)\)/);
 assert.match(src,/form\.dispatchEvent\(new Event\('os:create-hide'\)\)/);
 assert.match(progressive,/querySelector\('#os-plan-editor'\)/);
 assert.match(progressive,/form\.addEventListener\('os:create-show',show\)/);
 assert.match(src,/detail\.canEdit!==true/);
 assert.match(src,/คัดลอกเป็นแพ็กเกจใหม่/);
 assert.match(src,/rpc\('archive-plan'/);
 assert.match(src,/dialog\.showModal\(\)/);
 assert.match(src,/dialog\.close\(\)/);
 const css=source('public/saas-plan-workflow.css');
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/\.os-plan-manager/);
 assert.match(source('index.html'),/\/saas-plan-workflow\.css/);
});
