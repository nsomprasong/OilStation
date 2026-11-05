import {masterCase} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='C-02-F';
masterCase({id:MASTER_UAT_ID,description:'company-relationship-refresh',alias:'c02-admin',role:'corporate_admin',scopeType:'corporate_company',
 check:async({page,auth,headers,expect,BASE})=>{
 const getOwn=async()=>{
 const response=await page.request.get(BASE+'/api/my-accounts',{headers});
 expect(response.status()).toBe(200);
 const accounts=(await response.json()).accounts;
 expect(Array.isArray(accounts)).toBe(true);
 expect(accounts.length).toBeGreaterThan(0);
 expect(accounts.every(x=>x.companyId===auth.membership.corporateCompanyId)).toBe(true);
 return accounts.map(x=>({id:x.id,companyId:x.companyId,stationId:x.stationId})).sort((a,b)=>a.id.localeCompare(b.id));
};
const before=await getOwn();
await page.reload({waitUntil:'domcontentloaded'});
await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
const fresh=await page.evaluate(()=>{for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{return JSON.parse(localStorage.getItem(k)).access_token;}catch{}}return null;});
expect(fresh).toBeTruthy();const newHeaders={authorization:'Bearer '+fresh};
const after=await page.request.get(BASE+'/api/my-accounts',{headers:newHeaders});expect(after.status()).toBe(200);
const next=(await after.json()).accounts.map(x=>({id:x.id,companyId:x.companyId,stationId:x.stationId})).sort((a,b)=>a.id.localeCompare(b.id));
expect(next).toEqual(before);
console.log('MASTER_CASE C-02-F OWN_COMPANY_RELATIONSHIPS_STABLE_AFTER_RELOAD_PASS (12-global SQL verified separately)');
 }});
