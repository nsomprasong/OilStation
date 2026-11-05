import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='C-12-F';
masterCase({id:MASTER_UAT_ID,description:'corporate-offline-recovery-reload',alias:'c03-accountant',role:'accountant',scopeType:'corporate_company',
 check:async({page,auth,headers,expect,BASE})=>{
const initial=await page.request.get(BASE+'/api/my-accounts',{headers});expect(initial.status()).toBe(200);
const accounts=(await initial.json()).accounts;expect(Array.isArray(accounts)).toBe(true);
expect(accounts.length).toBeGreaterThan(0);expect(accounts.every(a=>a.companyId===auth.membership.corporateCompanyId)).toBe(true);
await page.context().setOffline(true);
const result=await page.evaluate(()=>fetch('/api/my-accounts').then(()=> 'unexpected_success').catch(()=>'offline_failed'));
expect(result).toBe('offline_failed');
await page.context().setOffline(false);
await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:35000});
const token=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{return JSON.parse(localStorage.getItem(k)).access_token;}catch{}}return null;});expect(token).toBeTruthy();
const recovered=await page.request.get(BASE+'/api/my-accounts',{headers:{authorization:'Bearer '+token}});expect(recovered.status()).toBe(200);
expect((await recovered.json()).accounts).toEqual(accounts);
console.log('MASTER_CASE C-12-F OFFLINE_RECOVERED_CORRECT_COMPANY_PASS');
}});
