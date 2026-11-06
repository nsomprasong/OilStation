import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='S-21-V';
masterCase({id:MASTER_UAT_ID,description:'nonexistent-saas-plan-denied-without-checkout',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const endpoint=BASE+'/api/station/billing/options?stationId='+STATION_B;
const before=await page.request.get(endpoint,{headers});expect(before.status()).toBe(200);
const original=(await before.json()).result;
const unknown='00000000-0000-4000-8000-000000000073';
expect(original.plans.every(x=>x.id!==unknown)).toBe(true);
const res=await page.request.post(BASE+'/api/station/billing/select',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_B,planId:unknown,paymentMethod:'card'}});
expect(res.status(),'unknown inactive plan must not create a checkout').toBe(409);
expect(await res.json()).toEqual({error:'plan_selection_unavailable'});
const after=await page.request.get(endpoint,{headers});expect(after.status()).toBe(200);
expect((await after.json()).result.selected).toEqual(original.selected);
console.log('MASTER_CASE S-21-V UNENTITLED_UNKNOWN_PLAN_DENIED_WITHOUT_CHECKOUT_PASS');
}});
