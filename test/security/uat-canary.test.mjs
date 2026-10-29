import test from 'node:test';
import assert from 'node:assert/strict';
import canary from '../../ops/uat-canary.mjs';
const url='https://oilstation-uat.nsomprasong.workers.dev';
test('UAT provisioning canary cannot impersonate deploy-ready OilStation',async()=>{
 const home=await canary.fetch(new Request(url));
 assert.equal(home.status,200);
 const h=await home.text();
 assert.match(h,/ยังไม่ใช่ตัวแอป OilStation/);
 assert.match(h,/noindex,nofollow/);
 const status=await canary.fetch(new Request(url+'/api/health'));
 assert.deepEqual(await status.json(),{service:'oilstation-uat-canary',status:'provisioned_only'});
 const ready=await canary.fetch(new Request(url+'/api/ready'));
 assert.equal(ready.status,503);assert.deepEqual(await ready.json(),{ready:false,reason:'application_not_deployed'});
 const write=await canary.fetch(new Request(url+'/api/coupons',{method:'POST'}));
 assert.equal(write.status,503);
});
