import {masterCase} from '../scripts/qa/master-six-harness.mjs';
import {STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guarded fresh cases.
const MASTER_UAT_ID='X-02-V';
masterCase({id:MASTER_UAT_ID,description:'new bounded X-02-V authorized evidence',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:'76388e2c-ef36-4656-808b-7d0fbd1d2c35',check:async({page,headers,expect,BASE})=>{
const r=await page.request.get(BASE+'/api/station/customer-overview?stationId='+STATION_B,{headers});expect(r.status()).toBe(200);const rows=(await r.json()).accounts;expect(rows).toHaveLength(3);const mustExist=(items,name)=>{if(!items.some(x=>x.companyName===name))throw Error('HTTP200_BUT_EXPECTED_DATABASE_ENTITY_MISSING');return true;};for(const n of ['QA-S01-B-C01','QA-S01-B-C02','QA-S01-B-C03'])expect(mustExist(rows,n)).toBe(true);expect(()=>mustExist(rows,'QA-NO-SUCH-149')).toThrow('HTTP200_BUT_EXPECTED_DATABASE_ENTITY_MISSING');console.log('MASTER_CASE X-02-V HTTP_200_REQUIRES_REAL_ENTITY_PRESENCE_AND_MISSING_ENTITY_ASSERTION_FAILS_PASS (synthetic failure path not actual missing DB row)');
}});
