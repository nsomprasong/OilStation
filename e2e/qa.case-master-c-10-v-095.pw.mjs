import {masterCase,COMPANY_C01} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='C-10-V';
masterCase({id:MASTER_UAT_ID,description:'non-member-driver-assignment-denied-and-roster-intact',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:COMPANY_C01,
 check:async({page,auth,headers,expect,BASE})=>{
const url=BASE+'/api/corporate/drivers?companyId='+COMPANY_C01;
const before=await page.request.get(url,{headers});expect(before.status()).toBe(200);
const roster=(await before.json()).drivers;expect(roster.length).toBeGreaterThan(0);
const forged='00000000-0000-4000-8000-000000000095';
expect(roster.some(x=>x.userId===forged)).toBe(false);
const denied=await page.request.post(BASE+'/api/corporate/driver-vehicle',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{companyId:COMPANY_C01,driverUserId:forged,plate:'QA TEST 0095'}});
expect(denied.status(),'non-member driver assignment rejected before SQL vehicle insert').toBe(403);
expect(await denied.json()).toEqual({error:'permission_denied'});
const after=await page.request.get(url,{headers});expect(after.status()).toBe(200);
expect((await after.json()).drivers).toEqual(roster);
console.log('MASTER_CASE C-10-V NONMEMBER_DRIVER_DENIED_BEFORE_VEHICLE_INSERT_AND_ROSTER_SAME_PASS');
}});
