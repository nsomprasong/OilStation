import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../../src/worker.mjs';

const ROOT='https://oilstation.goldensoft.cloud';
const env={
 OILSTATION_DEPLOY_TARGET:'production',
 OILSTATION_PREVIEW_LOGIN_ENABLED:'true',
 OILSTATION_PREVIEW_OPERATIONS_ENABLED:'true',
 OILSTATION_API_ENABLED:'false',
 OILSTATION_QA_FINANCE_SIM_ENABLED:'false',
 OILSTATION_HR_OPERATIONS_ENABLED:'true',
 SUPABASE_URL:'https://cxihsotcpdnalswfoysx.supabase.co',
 SUPABASE_ANON_KEY:'public_no_secret',
 SUPABASE_SERVICE_ROLE_KEY:'fake_not_a_real_key',
};
const req=(path,method='GET')=>new Request(ROOT+path,{method,
 ...(method==='POST'?{headers:{origin:ROOT,'content-type':'application/json'},body:'{}'}:{})});
test('HR live gate is narrowly enabled in production config, full release stays locked',()=>{
 const config=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.vars.OILSTATION_HR_OPERATIONS_ENABLED,'true');
 assert.equal(config.vars.OILSTATION_API_ENABLED,'false');
 assert.equal(config.vars.OILSTATION_QA_FINANCE_SIM_ENABLED,'false');
 assert.notEqual(config.vars.OILSTATION_QA_HR_UAT_ENABLED,'true');
});
test('worker allows only authenticated HR workflow route while finance stays locked',async()=>{
 const routes=['/api/hr/roster?stationId=e22fb5ff-1878-446f-ab8d-585115e8a1a9',
  '/api/hr/payroll/readiness?employeeId=22222222-2222-4222-8222-222222222222',
  '/api/hr/leave?employeeId=22222222-2222-4222-8222-222222222222'];
 for(const path of routes){
  const r=await worker.fetch(req(path),{...env});
  assert.equal(r.status,401,path);
  assert.equal((await r.json()).error,'unauthenticated',path);
 }
 for(const path of ['/api/hr/payroll/drafts/line','/api/hr/payroll/drafts/review',
  '/api/hr/payroll/policies/propose','/api/hr/advances/request',
  '/api/hr/payees/register','/api/coupons','/api/topup/review',
  '/api/billing/payment-intent','/api/webhooks/stripe']){
  const result=await worker.fetch(req(path,'POST'),{...env});
  assert.equal(result.status,503,path);
  assert.equal((await result.json()).error,'release_not_enabled',path);
 }
 const ready=await worker.fetch(req('/api/ready'),{...env});
 assert.equal(ready.status,503,'HR operations never claim all-finance readiness');
});
test('HR routes fail closed when HR-only flag disabled or preview permissions off',async()=>{
 for(const changed of [
  {OILSTATION_HR_OPERATIONS_ENABLED:'false'},
  {OILSTATION_PREVIEW_OPERATIONS_ENABLED:'false'},
  {OILSTATION_PREVIEW_LOGIN_ENABLED:'false'},
 ]){
  const r=await worker.fetch(req('/api/hr/roster'),{...env,...changed});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'release_not_enabled');
 }
});
