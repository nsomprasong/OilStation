import {test,expect} from '@playwright/test';

const BASE='https://oilstation.goldensoft.cloud';
const DB='https://cxihsotcpdnalswfoysx.supabase.co';
const NAMES=['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
function secret(name){
 const value=process.env[name];
 if(!value)throw Error('Missing protected QA secret: '+name);
 return value;
}
async function qaEvidence(){
 const key=secret('OILSTATION_QA_DB_KEY');
 const headers={'apikey':key,'content-type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.authorization='Bearer '+key;
 const response=await fetch(DB+'/rest/v1/rpc/oilstation_qa_platform_evidence',{
  method:'POST',headers,body:JSON.stringify({p_qa_run_id:'QA-20261031-PLATFORM-001'})
 });
 if(!response.ok)throw Error('Protected QA evidence unavailable HTTP '+response.status);
 return response.json();
}

test('P-14 Support01 real login, restricted station audit and API denial @support',async({page},info)=>{
 test.skip(process.env.OILSTATION_QA_SUPPORT_RUN!=='true',
  'Run only from main workflow_dispatch under approved oilstation-qa environment');
 const before=await qaEvidence();
 expect(before.allStationsCount).toBe(5);
 expect(before.protectedStationCount).toBe(1);
 expect(before.stations.map(x=>x.name).sort()).toEqual(NAMES.slice().sort());
 expect(before.requests).toHaveLength(4);
 expect(before.audit).toHaveLength(4);
 expect(before.companiesCount).toBe(0);

 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill('support01');
 await page.locator('#qa-login-password').fill(secret('OILSTATION_QA_SUPPORT01_PASSWORD'));
 await page.locator('#qa-login-form button[type="submit"]').click();
 const supportLink=page.locator('[data-ws-go="support"]:visible').first();
 await expect(supportLink).toBeVisible();
 await expect(page.locator('[data-ws-go="stations"]')).toHaveCount(0);
 await expect(page.locator('[data-ws-go="sales"]')).toHaveCount(0);
 await expect(page.locator('[data-ws-go="billing"]')).toHaveCount(0);

 const token=await page.evaluate(()=>{
  for(const key of Object.keys(localStorage)){
   if(!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;
   try {const value=JSON.parse(localStorage.getItem(key));
    if(typeof value?.access_token==='string')return value.access_token;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 const headers={authorization:'Bearer '+token};
 const me=await page.request.get(BASE+'/api/me',{headers});
 expect(me.status()).toBe(200);
 const user=await me.json();
 expect(user.memberships).toHaveLength(1);
 expect(user.memberships[0].scopeType).toBe('platform');
 expect(user.memberships[0].role).toBe('platform_support');

 await supportLink.click();
 await expect(page.locator('[data-ws-screen="support"]')).toBeVisible();
 const status=page.locator('#platform-support-workspace .os-support-status');
 await expect(status).toContainText('แสดงปั๊ม 4 แห่ง');
 const result=await page.request.get(BASE+'/api/platform/support/overview',{headers});
 expect(result.status()).toBe(200);
 const payload=(await result.json()).result;
 expect(payload.readOnly).toBe(true);
 expect(payload.qaScope).toBe(true);
 expect(payload.stations.map(x=>x.name).sort()).toEqual(NAMES.slice().sort());
 const wire=JSON.stringify(payload);
 for(const deniedField of ['balance','driver','email','commission','invoice','password'])
  expect(wire.toLowerCase()).not.toContain(deniedField);
 await page.screenshot({path:info.outputPath('P-14-support-desktop.png'),animations:'disabled'});

 for(const path of ['/api/platform/stations','/api/platform/sales/workspace','/api/qa/scopes']){
  const forbidden=await page.request.get(BASE+path,{headers});
  expect(forbidden.status(),path).toBe(403);
 }
 const query=await page.request.get(BASE+'/api/platform/support/overview?stationId=all',{headers});
 expect(query.status()).toBe(400);
 const method=await page.request.post(BASE+'/api/platform/support/overview',{headers,data:{}});
 expect(method.status()).toBe(405);

 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('[data-ws-screen="support"]')).toBeVisible();
 await expect(status).toContainText('แสดงปั๊ม 4 แห่ง');
 await page.screenshot({path:info.outputPath('P-14-support-mobile.png'),animations:'disabled'});
 const after=await qaEvidence();
 expect(after.stations).toEqual(before.stations);
 expect(after.requests).toEqual(before.requests);
 expect(after.audit).toEqual(before.audit);
 expect(after.allStationsCount).toBe(5);
 expect(after.companiesCount).toBe(0);
});
