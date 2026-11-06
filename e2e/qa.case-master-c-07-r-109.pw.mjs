import {masterCase} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN protected by masterCase. No UI POSTs.
const MASTER_UAT_ID='C-07-R';
masterCase({id:MASTER_UAT_ID,description:'new bounded C-07-R authorized workflow',alias:'c01-admin',role:'corporate_admin',scopeType:'corporate_company',scopeId:'4e6a3fc9-217d-4543-885b-113f1f3ba4c3',check:async({page,headers,expect,BASE})=>{
const own=await page.request.get(BASE+'/api/corporate/wallet-integrity?accountId=07de207d-97cd-4f46-9683-d431d057c583',{headers});expect(own.status()).toBe(200);const integrity=(await own.json()).integrity;expect(integrity.readOnly).toBe(true);expect(integrity.bankReconciled).toBe(false);const foreign=await page.request.get(BASE+'/api/corporate/wallet-integrity?accountId=e42cf203-bd1e-43b4-b5bf-18b262b838ab',{headers});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:'permission_denied'});console.log('MASTER_CASE C-07-R CROSS_COMPANY_WALLET_LEDGER_READ_403_PASS');
}});
