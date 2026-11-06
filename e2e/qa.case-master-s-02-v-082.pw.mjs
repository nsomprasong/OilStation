import {masterCase,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by protected helper. No live business mutations.
const MASTER_UAT_ID='S-02-V';
masterCase({id:MASTER_UAT_ID,description:'invalid-invite-token-denied-no-membership',alias:'s02b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_S02B,
 check:async({page,auth,headers,expect,BASE})=>{
const url=BASE+'/api/members/directory?scopeType=station&scopeId='+STATION_S02B;
const before=await page.request.get(url,{headers});expect(before.status()).toBe(200);
const members=(await before.json()).members;expect(Array.isArray(members)).toBe(true);
for(const [token,error] of [['short','invalid_invitation'],['Z'.repeat(48),'invalid_or_expired_invitation']]){
 const res=await page.request.post(BASE+'/api/invitations/accept',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{token}});
 expect(res.status()).toBe(400);expect(await res.json()).toEqual({error});
}
const after=await page.request.get(url,{headers});expect(after.status()).toBe(200);expect((await after.json()).members).toEqual(members);
console.log('MASTER_CASE S-02-V INVALID_AND_NONEXISTENT_INVITE_TOKEN_DENIED_NO_MEMBERSHIP_CHANGE_PASS; actual expired real invite separate');
}});
