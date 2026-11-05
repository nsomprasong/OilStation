import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN: actual guard is in the shared protected browser harness.
const MASTER_UAT_ID='X-08-F';
masterCase({id:MASTER_UAT_ID,description:'deployed-guarded-preview-smoke',
 check:async({page,auth,headers,expect,BASE})=>{
 const [health,ready,config]=await Promise.all([page.request.get(BASE+'/api/health'),page.request.get(BASE+'/api/ready'),page.request.get(BASE+'/api/public-config')]);
expect(health.status()).toBe(200);expect(await health.json()).toMatchObject({service:'oilstation',status:'ok'});
expect(ready.status()).toBe(503);expect((await ready.json()).ready).toBe(false);
expect(config.status()).toBe(200);const pub=await config.json();
expect(pub.qaFinanceSimEnabled).toBe(false);
expect(pub.stripePublishableKey).toBe(null);
expect(pub.supabaseUrl).toBe('https://cxihsotcpdnalswfoysx.supabase.co');
console.log('MASTER_CASE X-08-F LIVE_GUARDED_PREVIEW_SMOKE_PASS (deploy SHA cross-checked by workflow, not exposed by public API)');
 }});
