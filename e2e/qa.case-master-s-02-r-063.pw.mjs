import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='S-02-R';
masterCase({id:MASTER_UAT_ID,description:'cashier-owner-invitation-denied',alias:'s01b-cashier',role:'cashier',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const denied=await page.request.post(BASE+'/api/invitations/create',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{email:'qa-denied-s01b-owner@qa.oilstation.invalid',roleCode:'station_owner',scopeType:'station',scopeId:STATION_B}});
expect(denied.status(),'cashier may not invite a station owner').toBe(403);
expect(await denied.json()).toEqual({error:'permission_denied'});
console.log('MASTER_CASE S-02-R CASHIER_STATION_OWNER_INVITE_DENIED_PASS');
}});
