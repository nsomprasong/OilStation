import {masterCase} from '../scripts/qa/master-six-harness.mjs';
const MASTER_UAT_ID='P-07-R';
masterCase({id:MASTER_UAT_ID,description:'own-organization-invoice-visible-other-denied',alias:'o01-billing',role:'billing_manager',scopeType:'organization',
check:async({page,headers,expect,BASE})=>{
const own='d6f31134-2c74-41d8-8bc3-6d83bb41840b',foreign='948d946d-aa98-4718-b246-991313371ddb';
const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
expect((await me.json()).memberships[0].organizationId).toBe(own);
const load=id=>page.request.get(BASE+'/api/billing/invoices?organizationId='+id,{headers});
const ownR=await load(own);expect(ownR.status()).toBe(200);
const invoices=(await ownR.json()).invoices;expect(invoices).toHaveLength(1);
expect(invoices[0].status).toBe('paid');
const other=await load(foreign);expect(other.status()).toBe(403);
expect(await other.json()).toEqual({error:'permission_denied'});
const again=await load(own);expect(again.status()).toBe(200);expect((await again.json()).invoices).toEqual(invoices);
console.log('MASTER_CASE P-07-R OWN_INVOICE_ONE_PAID_FOREIGN_ORGANIZATION_403_PASS');
}});
