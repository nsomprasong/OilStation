import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-01-V';
masterCase({id:MASTER_UAT_ID,description:'expired-format-token-denial',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const bad='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid';
const denied=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+bad}});
expect(denied.status()).toBe(401);expect(await denied.json()).toEqual({error:'unauthenticated'});
const legitimate=await page.request.get(BASE+'/api/me',{headers});expect(legitimate.status()).toBe(200);
console.log('MASTER_CASE P-01-V EXPIRED_FORMAT_UNTRUSTED_TOKEN_DENIED_PASS (not real signed expired session)');
}});
