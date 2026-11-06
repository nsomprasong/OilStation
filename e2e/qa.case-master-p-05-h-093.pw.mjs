import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// PKG addendum #205: deliberately safe live negative checks. NOT a successful
// plan switch or a validated effective date; both are blocked release gates.
// OILSTATION_QA_BATCH_RUN is enforced by the shared protected helper.
const MASTER_UAT_ID='P-05-H';
masterCase({id:MASTER_UAT_ID,description:'active-package-switch-and-effective-start-negative-gates',
 alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,headers,expect,BASE})=>{
 const endpoint=BASE+'/api/station/billing/options?stationId='+STATION_A;
 const read=async()=>{const r=await page.request.get(endpoint,{headers});expect(r.status()).toBe(200);return (await r.json()).result;};
 const before=await read();
 expect(Array.isArray(before.plans)).toBe(true);
 expect(before.plans.some(x=>x.frequency==='monthly')).toBe(true);
 expect(before.plans.some(x=>x.frequency==='yearly')).toBe(true);
 expect(before.plans).toHaveLength(2);
 for(const p of before.plans){
  expect(BigInt(p.card.totalSatang)).toBeGreaterThan(0n);
  expect(BigInt(p.promptpay.totalSatang)).toBeLessThan(BigInt(p.card.totalSatang));
 }
 // The live QA-S01-A fixture has an existing 'trialing' subscription (verified
 // independently through read-only DB snapshot). A different valid active plan
 // must be rejected BEFORE checkout/term mutation. This does NOT prove change.
 const target=before.plans.find(p=>p.code==='standard_year')??before.plans.find(p=>p.frequency==='yearly');
 expect(target).toBeTruthy();
 const body={stationId:STATION_A,planId:target.id,paymentMethod:'card'};
 const validHeaders={...headers,origin:BASE,'content-type':'application/json'};
 const unavailable=await page.request.post(BASE+'/api/station/billing/select',{headers:validHeaders,data:body});
 expect(unavailable.status(),'active subscription cannot be silently replaced').toBe(409);
 expect(await unavailable.json()).toEqual({error:'plan_selection_unavailable'});
 const scheduled=await page.request.post(BASE+'/api/station/billing/select',{headers:validHeaders,
  data:{...body,startsAt:'2026-12-01T00:00:00Z'}});
 expect(scheduled.status(),'current API does not support future replacement date').toBe(400);
 expect(await scheduled.json()).toEqual({error:'invalid_plan_selection'});
 const after=await read();
 expect(after.selected).toEqual(before.selected);
 expect(after.plans).toEqual(before.plans);
 console.log('MASTER_CASE P-05-H PACKAGE_QUOTES_MONTHLY_YEARLY_READONLY_PASS');
 console.log('MASTER_CASE P-05-H ACTIVE_SWITCH_DENIED_409_START_DATE_REJECTED_400_NO_CHECKOUT_WRITE_PASS');
 console.log('MASTER_CASE P-05-H POSITIVE_PACKAGE_SWITCH_AND_EFFECTIVE_DATE_UNSUPPORTED_BLOCKED_ISSUE_205');
}});
