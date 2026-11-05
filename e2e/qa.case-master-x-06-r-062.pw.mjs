import {masterCase,STATION_A,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN is required by the shared protected UAT harness.
const MASTER_UAT_ID='X-06-R';
masterCase({id:MASTER_UAT_ID,description:'membership-api-errors-do-not-expose-private-data',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
const response=await page.request.get(BASE+'/api/members/directory?scopeType=made_up&scopeId=00000000-0000-4000-8000-000000000062',{headers});
expect(response.status()).toBe(400);const payload=await response.json();
expect(payload).toEqual({error:'invalid_scope'});
const text=JSON.stringify(payload);for(const term of ['postgres','stack','password','service_role','SELECT','internal'])expect(text.toLowerCase()).not.toContain(term.toLowerCase());
const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
console.log('MASTER_CASE X-06-R INVALID_SCOPE_SAFE_ERROR_NO_LEAK_PASS');
}});
