import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected inside shared masterCase helper.
const MASTER_UAT_ID='P-06-V';
masterCase({id:MASTER_UAT_ID,description:'satang-quote-rounding-and-invalid-tax-boundary',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const optionsUrl=BASE+'/api/station/billing/options?stationId='+STATION_B;
const before=await page.request.get(optionsUrl,{headers});expect(before.status()).toBe(200);
const api=(await before.json()).result;
const plans=api.plans;expect(Array.isArray(plans)).toBe(true);
const candidate=plans.find(x=>x.card?.subtotalSatang!==undefined&&x.promptpay?.subtotalSatang!==undefined);
expect(candidate,'must have existing non-mutating plan quotes').toBeTruthy();
const check=(quote,method)=>{
 const i=(v)=>{expect(/^\d+$/.test(String(v))).toBe(true);return BigInt(v);};
 const subtotal=i(quote.subtotalSatang),discount=i(quote.discountSatang),rate=i(quote.rateBasisPoints);
 const expectedDiscount=method==='promptpay'?(subtotal*2n+50n)/100n:0n;
 expect(discount).toBe(expectedDiscount);
 const net=subtotal-discount,denom=quote.vatMode==='inclusive'?10000n+rate:10000n;
 expect(['inclusive','exclusive']).toContain(quote.vatMode);
 const tax=(net*rate+denom/2n)/denom;
 expect(i(quote.taxSatang)).toBe(tax);
 expect(i(quote.totalSatang)).toBe(quote.vatMode==='inclusive'?net:net+tax);
};
check(candidate.card,'card');check(candidate.promptpay,'promptpay');
for(const data of [
 {vatMode:'inclusive',rateBasisPoints:10001,effectiveOn:'2026-11-06'},
 {vatMode:'exclusive',rateBasisPoints:-1,effectiveOn:'2026-11-06'},
 {vatMode:'exclusive',rateBasisPoints:700,effectiveOn:'2026-02-30'}
]){
 const res=await page.request.post(BASE+'/api/platform/billing/tax',{headers:{...headers,origin:BASE,'content-type':'application/json'},data});
 expect(res.status()).toBe(400);expect(await res.json()).toEqual({error:'invalid_platform_billing'});
}
const after=await page.request.get(optionsUrl,{headers});expect(after.status()).toBe(200);
expect((await after.json()).result.selected).toEqual(api.selected);
console.log('MASTER_CASE P-06-V SATANG_ROUNDING_AND_INVALID_RATE_DENIAL_PASS; expired promo remains separate');
}});
