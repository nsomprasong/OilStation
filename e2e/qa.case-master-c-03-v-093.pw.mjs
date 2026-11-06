import {masterCase,STATION_A} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enabled only by protected serialized six-case workflow.
const MASTER_UAT_ID='C-03-V';
masterCase({id:MASTER_UAT_ID,description:'invalid-corporate-tax-number-ui-and-api',alias:'s01a-owner',role:'station_owner',scopeType:'station',scopeId:STATION_A,
 check:async({page,auth,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="customers"]:visible').first().click();
await expect(page.locator('[data-ws-screen="customers"]:visible')).toBeVisible();
const newTab=page.locator('[data-context-for="customers"] button[data-os-pane-key="new"]');await expect(newTab).toBeVisible();await newTab.click();
const form=page.locator('#customer-create');await expect(form).toBeVisible();
await form.locator('#customer-name').fill('QA-NOT-SUBMITTED-COMPANY');
await form.locator('#customer-email').fill('qa-invalid-tax@qa.oilstation.invalid');
await form.locator('#customer-tax').fill('123');
await form.locator('#customer-create-btn').click();
await expect(page.locator('#customer-notice')).toContainText('เลขภาษีต้องมี 13 หลัก');
const route=BASE+'/api/station/customer-overview?stationId='+STATION_A;
const before=await page.request.get(route,{headers});expect(before.status()).toBe(200);
const accounts=(await before.json()).accounts;expect(accounts).toHaveLength(3);
// Even when bypassing local validation, QA preview must refuse a tax ID write.
const bad=await page.request.post(BASE+'/api/station/customers',{headers:{...headers,origin:BASE,'content-type':'application/json'},data:{stationId:STATION_A,name:'QA-S01-A-C01',contactEmail:'qa-c01-admin@qa.oilstation.invalid',taxId:'123',paymentTermsDays:0,dueMode:'per_fill',statementCloseDay:null}});
expect(bad.status()).toBe(400);expect(await bad.json()).toEqual({error:'qa_fixture_only'});
const after=await page.request.get(route,{headers});expect(after.status()).toBe(200);expect((await after.json()).accounts).toEqual(accounts);
console.log('MASTER_CASE C-03-V INVALID_TAX_ID_UI_AND_QA_API_400_NO_COMPANY_WRITE_PASS');
}});
